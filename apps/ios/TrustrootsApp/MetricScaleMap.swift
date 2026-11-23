import CoreLocation
import MapKit
import SwiftUI

struct MetricScaleMap<Content: View>: View {
    @ViewBuilder let content: () -> Content
    @State private var size: CGSize = .zero
    @State private var scale: Scale?

    var body: some View {
        MapReader { proxy in
            content()
                .onGeometryChange(for: CGSize.self) { $0.size } action: { size in
                    self.size = size
                    scale = Scale(proxy: proxy, size: size)
                }
                .onMapCameraChange(frequency: .continuous) { _ in
                    scale = Scale(proxy: proxy, size: size)
                }
                .overlay(alignment: .bottomTrailing) {
                    if let scale {
                        VStack(spacing: 3) {
                            Text(scale.label)
                                .font(.caption2.weight(.semibold))
                                .monospacedDigit()
                                .accessibilityIdentifier("map-distance-scale")
                            Path { path in
                                path.move(to: .zero)
                                path.addLine(to: CGPoint(x: 0, y: 4))
                                path.addLine(to: CGPoint(x: scale.width, y: 4))
                                path.addLine(to: CGPoint(x: scale.width, y: 0))
                            }
                            .stroke(.primary, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                            .frame(width: scale.width, height: 5)
                            .accessibilityHidden(true)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8))
                        .shadow(color: .black.opacity(0.18), radius: 4, y: 2)
                        .padding(8)
                        .allowsHitTesting(false)
                    }
                }
        }
    }

    private struct Scale {
        let metres: Double
        let width: CGFloat

        var label: String {
            let kilometres = metres >= 1000
            let value = kilometres ? metres / 1000 : metres
            return "\(value.formatted()) \(kilometres ? "km" : "m")"
        }

        init?(proxy: MapProxy, size: CGSize) {
            let sampleWidth = min(100, size.width / 2)
            guard sampleWidth > 0, size.height > 0 else { return nil }
            let y = size.height / 2
            let startPoint = CGPoint(x: (size.width - sampleWidth) / 2, y: y)
            let endPoint = CGPoint(x: startPoint.x + sampleWidth, y: y)
            guard let start = proxy.convert(startPoint, from: .local),
                  let end = proxy.convert(endPoint, from: .local) else { return nil }
            let distance = CLLocation(latitude: start.latitude, longitude: start.longitude)
                .distance(from: CLLocation(latitude: end.latitude, longitude: end.longitude))
            guard distance.isFinite, distance > 0 else { return nil }

            let magnitude = pow(10, floor(log10(distance)))
            let multiplier = [5.0, 2.0, 1.0].first { $0 * magnitude <= distance } ?? 1
            metres = multiplier * magnitude
            width = sampleWidth * CGFloat(metres / distance)
        }
    }
}
