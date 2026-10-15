// Render the existing BOS/42 sign design as an opaque App Store-size icon.
// Run from the project directory: swift scripts/render-ios-icon.swift
import AppKit

let size = 1024
let canvas = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
    bytesPerRow: size * 4, space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
let context = NSGraphicsContext(cgContext: canvas, flipped: false)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
let ink = NSColor(srgbRed: 16/255, green: 25/255, blue: 30/255, alpha: 1)
ink.setFill()
NSRect(x: 0, y: 0, width: size, height: size).fill()
NSColor(srgbRed: 246/255, green: 203/255, blue: 53/255, alpha: 1).setFill()
NSBezierPath(roundedRect: NSRect(x: 92, y: 264, width: 840, height: 500), xRadius: 16, yRadius: 16).fill()
let border = NSBezierPath(rect: NSRect(x: 116, y: 288, width: 792, height: 452))
border.lineWidth = 16
ink.setStroke()
border.stroke()
func label(_ text: String, y: CGFloat, pointSize: CGFloat) {
    let font = NSFont(name: "Arial-BoldMT", size: pointSize) ?? NSFont.boldSystemFont(ofSize: pointSize)
    let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: ink]
    let string = text as NSString
    let dimensions = string.size(withAttributes: attrs)
    string.draw(at: NSPoint(x: (CGFloat(size) - dimensions.width) / 2, y: y), withAttributes: attrs)
}
label("BOS", y: 480, pointSize: 180)
label("/ 42", y: 330, pointSize: 152)
NSGraphicsContext.restoreGraphicsState()
let destination = URL(fileURLWithPath: "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")
let bitmap = NSBitmapImageRep(cgImage: canvas.makeImage()!)
try bitmap.representation(using: .png, properties: [:])!.write(to: destination)
print("Rendered BOS/42 iPad icon: 1024 × 1024, opaque RGB")
