import Capacitor

class BOSViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(WindowMotionPlugin())
        NSLog("BOS/42 window motion plugin registered")
    }
}
