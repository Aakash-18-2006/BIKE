// GpsSensor.js - GNSS Hardware Simulator with Real-world Navigation Waypoints
export class GpsSensor {
  constructor(initialLat = 12.9716, initialLon = 77.5946) {
    this.latitude = initialLat;
    this.longitude = initialLon;
    this.heading = 78;
    this.speed = 0;
    this.satellites = 11;
    this.accuracy = 1.8; // meters
    this.step = 0;
    this.fixType = '3D_FIX';

    // Route waypoint sequence along major highway (e.g. Bangalore Outer Ring Road towards Chennai Highway)
    this.routeWaypoints = [
      { lat: 12.9716, lon: 77.5946, road: 'Kasturba Road', instruction: 'CONTINUE STRAIGHT', arrow: 'STRAIGHT', distM: 800 },
      { lat: 12.9745, lon: 77.6012, road: 'Cubbon Road', instruction: 'BEAR RIGHT ONTO MG ROAD', arrow: 'SLIGHT_RIGHT', distM: 1200 },
      { lat: 12.9752, lon: 77.6105, road: 'MG Road Expressway', instruction: 'KEEP LEFT TOWARDS INDIRANAGAR', arrow: 'KEEP_LEFT', distM: 2100 },
      { lat: 12.9785, lon: 77.6408, road: 'Old Airport Road', instruction: 'TURN LEFT IN 300 m', arrow: 'TURN_LEFT', distM: 300 },
      { lat: 12.9812, lon: 77.6521, road: 'Chennai Road', instruction: 'ENTER CHENNAI EXPRESSWAY', arrow: 'HIGHWAY_MERGE', distM: 4500 },
      { lat: 12.9901, lon: 77.6890, road: 'NH 48 / Chennai Highway', instruction: 'CONTINUE FOR 8.5 KM', arrow: 'STRAIGHT', distM: 8500 },
      { lat: 13.0015, lon: 77.7210, road: 'Tech Gateway Expressway', instruction: 'ARRIVING AT DESTINATION', arrow: 'DESTINATION', distM: 200 },
    ];
    this.currentWaypointIndex = 3; // Positioned near 'Chennai Road' turn as requested
    this.totalRouteDistanceKm = 14.8;
    this.distanceRemainingKm = 12.4;
    this.destinationName = 'Tech Park / Chennai Road Corridor';
  }

  update(speedKmh) {
    this.speed = speedKmh;
    if (speedKmh > 0) {
      this.step += 0.05;
      const deltaLat = (speedKmh / 3600 / 111) * Math.cos((this.heading * Math.PI) / 180);
      const deltaLon = (speedKmh / 3600 / 111) * Math.sin((this.heading * Math.PI) / 180);

      this.latitude += deltaLat;
      this.longitude += deltaLon;

      // Slowly decrement remaining distance as bike travels
      const traveledKm = (speedKmh / 3600);
      this.distanceRemainingKm = Math.max(0.1, Number((this.distanceRemainingKm - traveledKm).toFixed(2)));

      // Advance route instructions
      if (this.distanceRemainingKm < 11.5 && this.currentWaypointIndex === 3) {
        this.currentWaypointIndex = 4;
      } else if (this.distanceRemainingKm < 7.0 && this.currentWaypointIndex === 4) {
        this.currentWaypointIndex = 5;
      }
    }
    return this.getData();
  }

  getNavigationData() {
    const activeWp = this.routeWaypoints[this.currentWaypointIndex] || this.routeWaypoints[0];
    
    // Dynamic ETA calculation: current time + remaining distance / avg speed (40 km/h baseline)
    const etaDate = new Date(Date.now() + (this.distanceRemainingKm / 35) * 3600 * 1000);
    const etaFormatted = etaDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    return {
      active: true,
      currentRoad: activeWp.road,
      destination: this.destinationName,
      nextTurnInstruction: activeWp.instruction,
      nextTurnDistanceMeters: activeWp.distM,
      directionArrow: activeWp.arrow,
      distanceRemainingKm: this.distanceRemainingKm,
      totalRouteDistanceKm: this.totalRouteDistanceKm,
      eta: etaFormatted,
      gpsFixType: this.fixType,
      satellites: this.satellites,
      accuracy: this.accuracy,
      currentPosition: {
        lat: Number(this.latitude.toFixed(6)),
        lng: Number(this.longitude.toFixed(6)),
      },
      destinationPosition: {
        lat: 13.0015,
        lng: 77.7210,
      },
      routePolyline: this.routeWaypoints.map(wp => ({ lat: wp.lat, lng: wp.lon, road: wp.road })),
    };
  }

  getData() {
    return {
      latitude: Number(this.latitude.toFixed(6)),
      longitude: Number(this.longitude.toFixed(6)),
      speed: Number(this.speed.toFixed(1)),
      heading: Math.round(this.heading),
      accuracy: this.accuracy,
      satellites: this.satellites,
      fixType: this.fixType,
      navigation: this.getNavigationData(),
    };
  }
}
