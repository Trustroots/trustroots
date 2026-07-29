import CoreLocation
import MapKit
import SwiftUI

struct LocationPreviewView: View {
    let title: String
    let location: String
    @State private var position = MapCameraPosition.automatic
    @State private var coordinate: CLLocationCoordinate2D?
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            if let coordinate {
                Map(position: $position) {
                    Marker(location, coordinate: coordinate)
                }
            } else if let errorMessage {
                ContentUnavailableView("Location unavailable", systemImage: "mappin.slash", description: Text(errorMessage))
            } else {
                ProgressView("Finding location…")
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task { await geocode() }
    }

    private func geocode() async {
        do {
            let placemarks = try await CLGeocoder().geocodeAddressString(location)
            guard let result = placemarks.first?.location?.coordinate else {
                errorMessage = "Trustroots could not find this place."
                return
            }
            coordinate = result
            position = .region(MKCoordinateRegion(
                center: result,
                span: MKCoordinateSpan(latitudeDelta: 0.25, longitudeDelta: 0.25)
            ))
        } catch {
            errorMessage = "Trustroots could not find this place."
        }
    }
}
