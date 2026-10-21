import Foundation

enum AttachmentStore {
    private static var directory: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("TailoredAgentsAttachments", isDirectory: true)
    }

    static func destination(for filename: String) throws -> URL {
        var folder = directory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true,
                                               attributes: [.protectionKey: FileProtectionType.complete])
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try folder.setResourceValues(values)
        return folder.appendingPathComponent(AppPolicy.downloadFilename(filename), isDirectory: false)
    }

    static func remove(_ file: URL) {
        let folder = file.deletingLastPathComponent()
        guard folder.deletingLastPathComponent().standardizedFileURL == directory.standardizedFileURL else { return }
        try? FileManager.default.removeItem(at: folder)
    }

    static func removeLeftovers() { try? FileManager.default.removeItem(at: directory) }
}
