import SwiftUI

struct SignInView: View {
    @ObservedObject var session: MemberSessionStore
    @State private var usernameOrEmail = ""
    @State private var password = ""
    @State private var browserRoute: TrustrootsBrowserRoute?
    @State private var apiStatus: MobileAPIStatus?

    private let api = TrustrootsAPI()

    private let trustrootsGreen = Color(red: 0.07, green: 0.71, blue: 0.57)
    private let trustrootsBrown = Color(red: 0.36, green: 0.23, blue: 0.08)

    var body: some View {
        NavigationStack {
            if let browserRoute {
                TrustrootsBrowserView(route: browserRoute) {
                    self.browserRoute = nil
                }
            } else {
                ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.94, green: 0.98, blue: 0.97),
                        Color(red: 0.99, green: 0.99, blue: 0.97),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 0) {
                        HStack {
                            Text("Travellers’ community")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(trustrootsBrown.opacity(0.72))
                            Spacer()
                            Button("Join") {
                                browserRoute = .join
                            }
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 17)
                            .padding(.vertical, 9)
                            .background(trustrootsGreen)
                            .clipShape(Capsule())
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 16)

                        VStack(spacing: 10) {
                            Image("TrustrootsLogo")
                                .resizable()
                                .scaledToFit()
                                .frame(width: 118, height: 118)
                                .accessibilityLabel("Trustroots")
                            Text("Sharing, hosting and getting people together.")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(trustrootsBrown.opacity(0.72))
                                .multilineTextAlignment(.center)
                        }
                        .padding(.top, 34)
                        .padding(.bottom, 30)

                        VStack(alignment: .leading, spacing: 20) {
                            VStack(alignment: .leading, spacing: 5) {
                                Text("Welcome back")
                                    .font(.title2.weight(.bold))
                                    .foregroundStyle(.primary)
                                Text("Sign in to find your people and messages.")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }

                            VStack(spacing: 0) {
                                TextField("Username or email", text: $usernameOrEmail)
                                    .textContentType(.username)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 15)

                                Divider()
                                    .padding(.leading, 16)

                                SecureField("Password", text: $password)
                                    .textContentType(.password)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 15)
                            }
                            .background(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(trustrootsGreen.opacity(0.16), lineWidth: 1)
                            }

                            if let errorMessage = session.errorMessage {
                                Label(errorMessage, systemImage: "exclamationmark.circle.fill")
                                    .font(.footnote)
                                    .foregroundStyle(.red)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            Button {
                                Task {
                                    await session.signIn(usernameOrEmail: usernameOrEmail, password: password)
                                }
                            } label: {
                                HStack(spacing: 10) {
                                    if session.isSigningIn {
                                        ProgressView()
                                            .tint(.white)
                                    } else {
                                        Image(systemName: "arrow.right.circle.fill")
                                    }
                                    Text(session.isSigningIn ? "Signing in…" : "Sign in")
                                }
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                            }
                            .foregroundStyle(.white)
                            .background(trustrootsGreen)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .disabled(session.isSigningIn)

#if DEBUG && targetEnvironment(simulator)
                            Picker("API server", selection: $session.serverURLString) {
                                Text("Local API")
                                    .tag(TrustrootsAPIConfiguration.localDefaultURLString)
                                Text("PR 2777")
                                    .tag(TrustrootsAPIConfiguration.catTestURLString)
                            }
                            .pickerStyle(.segmented)
                            .disabled(session.isSigningIn)
#endif

                            Text("API: \(serverHost)")
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                                .lineLimit(1)
                                .minimumScaleFactor(0.72)
                                .textSelection(.enabled)
                            if let apiStatus {
                                Text("API build: \(apiStatus.buildVersion)")
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(.secondary)
                            }
                            Text("iOS build: \(TrustrootsBuildInfo.formatted())")
                                .font(.caption2.monospaced())
                                .foregroundStyle(.secondary)
                                .accessibilityLabel("iOS build time: \(TrustrootsBuildInfo.formatted())")
                            .frame(maxWidth: .infinity)
                        }
                        .padding(24)
                        .background(.white.opacity(0.86))
                        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        .shadow(color: trustrootsBrown.opacity(0.10), radius: 20, y: 8)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 28)
                    }
                }
                }
                .toolbar(.hidden, for: .navigationBar)
            }
        }
        .task(id: session.serverURLString) {
            apiStatus = try? await api.status(serverURLString: session.serverURLString)
        }
    }

    private var normalizedServerURL: String {
        TrustrootsAPIConfiguration(baseURLString: session.serverURLString)?.normalizedURLString
            ?? session.serverURLString
    }

    private var serverHost: String {
        URL(string: normalizedServerURL)?.host ?? normalizedServerURL
    }

}
