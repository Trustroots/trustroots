package org.trustroots.android.nostr

import java.math.BigInteger
import java.security.SecureRandom
import org.bouncycastle.crypto.ec.CustomNamedCurves
import org.bouncycastle.math.ec.FixedPointCombMultiplier

internal object NostrKeyCodec {
    private const val alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
    private val generators = intArrayOf(0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3)
    private val curve = CustomNamedCurves.getByName("secp256k1")
    private val random = SecureRandom()

    fun generate(): ByteArray = generate(random::nextBytes)

    internal fun generate(fillBytes: (ByteArray) -> Unit): ByteArray {
        val secret = ByteArray(32)
        do fillBytes(secret) while (!valid(secret))
        return secret
    }

    fun import(input: String): ByteArray {
        val trimmed = input.trim()
        val value = trimmed.lowercase()
        val secret = when {
            value.matches(Regex("[0-9a-f]{64}")) -> value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
            else -> {
                require(trimmed == value || trimmed == trimmed.uppercase())
                require(value.length == 63 && value.startsWith("nsec1"))
                val digits = value.drop(5).map { character ->
                    alphabet.indexOf(character).also { require(it >= 0) }
                }
                require(checksum(expand("nsec") + digits) == 1)
                val converted = convert(digits.dropLast(6), 5, 8, false)
                require(digits.dropLast(6) == convert(converted, 8, 5, true))
                converted.map(Int::toByte).toByteArray()
            }
        }
        require(valid(secret))
        return secret
    }

    fun npub(secret: ByteArray): String = encode("npub", publicKey(secret))

    fun publicKey(secret: ByteArray): ByteArray {
        require(valid(secret))
        val point = FixedPointCombMultiplier().multiply(curve.g, BigInteger(1, secret)).normalize()
        return point.affineXCoord.encoded
    }

    fun nsec(secret: ByteArray): String {
        require(valid(secret))
        return encode("nsec", secret)
    }

    private fun valid(secret: ByteArray): Boolean {
        val scalar = BigInteger(1, secret)
        return secret.size == 32 && scalar.signum() > 0 && scalar < curve.n
    }

    private fun encode(prefix: String, bytes: ByteArray): String {
        val digits = convert(bytes.map { it.toInt() and 255 }, 8, 5, true)
        val check = checksum(expand(prefix) + digits + List(6) { 0 }) xor 1
        return prefix + "1" + (digits + List(6) { (check shr (5 * (5 - it))) and 31 })
            .joinToString("") { alphabet[it].toString() }
    }

    private fun expand(prefix: String) = prefix.map { it.code shr 5 } + 0 + prefix.map { it.code and 31 }

    private fun checksum(digits: List<Int>): Int {
        var value = 1
        for (digit in digits) {
            val top = value ushr 25
            value = ((value and 0x1ffffff) shl 5) xor digit
            for (index in generators.indices) {
                if ((top and (1 shl index)) != 0) value = value xor generators[index]
            }
        }
        return value
    }

    private fun convert(digits: List<Int>, from: Int, to: Int, pad: Boolean): List<Int> = buildList {
        val mask = (1 shl to) - 1
        var bits = 0
        var accumulator = 0
        for (digit in digits) {
            accumulator = ((accumulator shl from) or digit) and ((1 shl (from + to - 1)) - 1)
            bits += from
            while (bits >= to) {
                bits -= to
                add((accumulator ushr bits) and mask)
            }
        }
        // Encoding a 32-byte key always leaves one bit for the final digit.
        if (pad) add((accumulator shl (to - bits)) and mask)
    }
}
