package org.trustroots.android.nostr

import java.math.BigInteger
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import org.bouncycastle.crypto.agreement.ECDHBasicAgreement
import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.crypto.engines.ChaCha7539Engine
import org.bouncycastle.crypto.generators.HKDFBytesGenerator
import org.bouncycastle.crypto.params.ECPrivateKeyParameters
import org.bouncycastle.crypto.params.HKDFParameters
import org.bouncycastle.crypto.params.KeyParameter
import org.bouncycastle.crypto.params.ParametersWithIV
import org.bouncycastle.crypto.signers.BIP340Signer
import org.bouncycastle.util.BigIntegers

/** Bounded NIP-44 v2 codec for NIP-46 messages. Verify the signed envelope before opening. */
internal object NostrConnectEncryption {
    private const val maxPlaintext = 16_384
    internal const val maxEncoded = 21_936
    private const val nonceSize = 32
    private const val macSize = 32
    private val random = SecureRandom()

    fun conversationKey(secret: ByteArray, peer: ByteArray): ByteArray {
        val publicKey = requireNotNull(BIP340Signer.decodePublicKey(peer))
        val agreement = ECDHBasicAgreement().apply {
            init(ECPrivateKeyParameters(BigInteger(1, secret), BIP340Signer.getDomain()))
        }
        val sharedX = BigIntegers.asUnsignedByteArray(32, agreement.calculateAgreement(publicKey))
        return try {
            mac("nip44-v2".encodeToByteArray(), sharedX)
        } finally {
            sharedX.fill(0)
        }
    }

    fun encrypt(
        text: String,
        conversationKey: ByteArray,
        nonce: ByteArray = ByteArray(nonceSize).also(random::nextBytes),
    ): String {
        require(text.length in 1..maxPlaintext)
        val message = text.encodeToByteArray(throwOnInvalidSequence = true)
        try {
            require(message.size in 1..maxPlaintext)
            val padded = ByteArray(2 + paddedLength(message.size))
            padded[0] = (message.size ushr 8).toByte()
            padded[1] = message.size.toByte()
            message.copyInto(padded, 2)
            return try {
                withKeys(conversationKey, nonce) { chacha, iv, hmac ->
                    val ciphertext = crypt(chacha, iv, padded)
                    Base64.getEncoder().encodeToString(byteArrayOf(2) + nonce + ciphertext + mac(hmac, nonce, ciphertext))
                }
            } finally {
                padded.fill(0)
            }
        } finally {
            message.fill(0)
        }
    }

    fun decrypt(payload: String, conversationKey: ByteArray): String {
        require(payload.length in 132..maxEncoded)
        val data = Base64.getDecoder().decode(payload)
        require(data.size in 99..(1 + nonceSize + 2 + maxPlaintext + macSize) && data[0] == 2.toByte())
        val nonce = data.copyOfRange(1, 1 + nonceSize)
        val ciphertext = data.copyOfRange(1 + nonceSize, data.size - macSize)
        val tag = data.copyOfRange(data.size - macSize, data.size)
        return withKeys(conversationKey, nonce) { chacha, iv, hmac ->
            require(MessageDigest.isEqual(tag, mac(hmac, nonce, ciphertext)))
            val padded = crypt(chacha, iv, ciphertext)
            try {
                val length = ((padded[0].toInt() and 255) shl 8) or (padded[1].toInt() and 255)
                require(length in 1..maxPlaintext && padded.size == 2 + paddedLength(length))
                padded.decodeToString(2, 2 + length, throwOnInvalidSequence = true)
            } finally {
                padded.fill(0)
            }
        }
    }

    private fun paddedLength(length: Int): Int {
        if (length <= 32) return 32
        val nextPower = Integer.highestOneBit(length - 1) shl 1
        val chunk = if (nextPower <= 256) 32 else nextPower / 8
        return ((length - 1) / chunk + 1) * chunk
    }

    private fun <T> withKeys(key: ByteArray, nonce: ByteArray, use: (ByteArray, ByteArray, ByteArray) -> T): T {
        require(key.size == 32 && nonce.size == nonceSize)
        val material = ByteArray(76)
        HKDFBytesGenerator(SHA256Digest()).apply {
            init(HKDFParameters.skipExtractParameters(key, nonce))
            generateBytes(material, 0, material.size)
        }
        val chacha = material.copyOfRange(0, 32)
        val iv = material.copyOfRange(32, 44)
        val hmac = material.copyOfRange(44, 76)
        material.fill(0)
        return try {
            use(chacha, iv, hmac)
        } finally {
            chacha.fill(0)
            iv.fill(0)
            hmac.fill(0)
        }
    }

    private fun crypt(key: ByteArray, iv: ByteArray, message: ByteArray): ByteArray =
        ByteArray(message.size).also { result ->
            ChaCha7539Engine().apply {
                init(true, ParametersWithIV(KeyParameter(key), iv))
                processBytes(message, 0, message.size, result, 0)
            }
        }

    private fun mac(key: ByteArray, vararg parts: ByteArray): ByteArray =
        Mac.getInstance("HmacSHA256").run {
            init(SecretKeySpec(key, "HmacSHA256"))
            parts.forEach { update(it) }
            doFinal()
        }
}
