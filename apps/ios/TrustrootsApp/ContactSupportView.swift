import SwiftUI

struct ContactSupportView: View {
    @ObservedObject var session: MemberSessionStore
    let openFAQ: () -> Void
    @State private var message = ""
    @State private var isSending = false
    @State private var sent = false
    @State private var errorMessage: String?

    private let api = TrustrootsAPI()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Contact and support")
                    .font(.largeTitle.bold())

                if sent {
                    ContentUnavailableView(
                        "Message sent",
                        systemImage: "checkmark.circle.fill",
                        description: Text("Trustroots support will get back to you as soon as they can.")
                    )
                    .frame(maxWidth: .infinity, minHeight: 280)
                } else {
                    Text("Tell the Trustroots support team how they can help.")
                        .foregroundStyle(.secondary)

                    TextEditor(text: $message)
                        .frame(minHeight: 150)
                        .padding(10)
                        .overlay {
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.secondary.opacity(0.28))
                        }
                        .accessibilityLabel("Message")

                    if let errorMessage {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                    }

                    Button {
                        Task { await send() }
                    } label: {
                        HStack {
                            Spacer()
                            if isSending {
                                ProgressView().tint(.white)
                            } else {
                                Text("Send message")
                                    .fontWeight(.semibold)
                            }
                            Spacer()
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(TrustrootsPalette.green)
                    .disabled(message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Quick help")
                            .font(.headline)
                        Text("You may find an answer before sending a message.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Button("Browse frequently asked questions", action: openFAQ)
                            .font(.subheadline.weight(.semibold))
                        Text("For urgent safety concerns, contact local emergency services first.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func send() async {
        guard !isSending else { return }
        isSending = true
        errorMessage = nil
        defer { isSending = false }

        do {
            try await api.sendSupportMessage(
                serverURLString: session.serverURLString,
                message: message.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            message = ""
            sent = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
