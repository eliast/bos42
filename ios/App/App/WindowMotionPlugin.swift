import Capacitor
import CoreMotion
import UIKit

@objc(WindowMotionPlugin)
public class WindowMotionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WindowMotionPlugin"
    public let jsName = "WindowMotion"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]
    private let manager = CMMotionManager()
    private var requested = false
    private var sessionID = UUID().uuidString
    private var lastAzimuth = 0.0

    public override func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(suspend), name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(resume), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.manager.isDeviceMotionAvailable else {
                call.reject("Motion sensors are unavailable on this device."); return
            }
            self.requested = true
            if !self.manager.isDeviceMotionActive { self.begin() }
            call.resolve(["sessionID": self.sessionID])
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.requested = false
            self.manager.stopDeviceMotionUpdates()
            call.resolve()
        }
    }

    private func begin() {
        sessionID = UUID().uuidString
        let currentSession = sessionID
        var firstReading = true
        manager.deviceMotionUpdateInterval = 1.0 / 30.0
        // Relative gyro/gravity tracking avoids compass corrections near window frames.
        manager.startDeviceMotionUpdates(using: .xArbitraryZVertical, to: .main) { [weak self] motion, error in
            guard let self = self, currentSession == self.sessionID else { return }
            if error != nil {
                self.manager.stopDeviceMotionUpdates()
                self.notifyListeners("motion", data: ["type": "error", "message": "Motion readings stopped. Tap the target to retry."])
                return
            }
            guard let motion = motion else { return }
            // Core Motion's rotation maps reference coordinates into device coordinates.
            // Its transposed third row gives the rear-camera axis in the reference frame.
            let matrix = motion.attitude.rotationMatrix
            let x = -matrix.m31, y = -matrix.m32, z = -matrix.m33
            let horizontal = hypot(x, y)
            if horizontal > 0.05 { self.lastAzimuth = atan2(x, y) * 180.0 / .pi }
            let elevation = atan2(z, horizontal) * 180.0 / .pi
            if firstReading {
                NSLog("BOS/42 native motion ready")
                firstReading = false
            }
            self.notifyListeners("motion", data: ["type": "sample", "sessionID": currentSession,
                "azimuth": self.lastAzimuth, "elevation": elevation])
        }
    }

    @objc private func suspend() {
        guard requested else { return }
        manager.stopDeviceMotionUpdates()
        sessionID = UUID().uuidString
        notifyListeners("motion", data: ["type": "reset"])
    }

    @objc private func resume() {
        if requested && !manager.isDeviceMotionActive { begin() }
    }

    deinit {
        manager.stopDeviceMotionUpdates()
        NotificationCenter.default.removeObserver(self)
    }
}
