// ios-share-extension/ShareViewController.swift
//
// Minimal share extension: captures text/URL from the host app, writes it to
// the App Group UserDefaults so the main app can pick it up on next foreground.
// Shows a branded "Saving…" overlay then auto-dismisses.

import UIKit

class ShareViewController: UIViewController {

    private let appGroup   = "group.com.beforeitbills.app"
    private let pendingKey = "bib_pending_share"

    // Accent colour matching the app's theme (#7DD3FC)
    private let accentColor = UIColor(red: 0.49, green: 0.827, blue: 0.988, alpha: 1)
    private let bgColor     = UIColor(red: 0.043, green: 0.059, blue: 0.090, alpha: 1) // #0B0F17

    override func viewDidLoad() {
        super.viewDidLoad()
        buildUI()
        extractContent()
    }

    // ── UI ────────────────────────────────────────────────────────────────────

    private func buildUI() {
        view.backgroundColor = bgColor

        // Card
        let card = UIView()
        card.backgroundColor = UIColor(red: 0.086, green: 0.106, blue: 0.141, alpha: 1) // surface
        card.layer.cornerRadius = 22
        card.layer.borderWidth  = 1
        card.layer.borderColor  = UIColor.white.withAlphaComponent(0.08).cgColor
        card.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(card)

        // Icon background
        let iconWrap = UIView()
        iconWrap.backgroundColor = accentColor.withAlphaComponent(0.15)
        iconWrap.layer.cornerRadius = 16
        iconWrap.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(iconWrap)

        let icon = UILabel()
        icon.text = "💳"
        icon.font = .systemFont(ofSize: 28)
        icon.textAlignment = .center
        icon.translatesAutoresizingMaskIntoConstraints = false
        iconWrap.addSubview(icon)

        let title = UILabel()
        title.text = "BeforeItBills"
        title.textColor = .white
        title.font = .boldSystemFont(ofSize: 18)
        title.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(title)

        let subtitle = UILabel()
        subtitle.text = "Saving receipt…"
        subtitle.textColor = UIColor.white.withAlphaComponent(0.55)
        subtitle.font = .systemFont(ofSize: 14, weight: .semibold)
        subtitle.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(subtitle)

        let spinner = UIActivityIndicatorView(style: .medium)
        spinner.color = accentColor
        spinner.startAnimating()
        spinner.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(spinner)

        NSLayoutConstraint.activate([
            // Card: centred, fixed width, intrinsic height
            card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            card.widthAnchor.constraint(equalToConstant: 260),

            // Icon wrap
            iconWrap.topAnchor.constraint(equalTo: card.topAnchor, constant: 24),
            iconWrap.centerXAnchor.constraint(equalTo: card.centerXAnchor),
            iconWrap.widthAnchor.constraint(equalToConstant: 56),
            iconWrap.heightAnchor.constraint(equalToConstant: 56),

            icon.centerXAnchor.constraint(equalTo: iconWrap.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconWrap.centerYAnchor),

            title.topAnchor.constraint(equalTo: iconWrap.bottomAnchor, constant: 14),
            title.centerXAnchor.constraint(equalTo: card.centerXAnchor),

            subtitle.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 6),
            subtitle.centerXAnchor.constraint(equalTo: card.centerXAnchor),

            spinner.topAnchor.constraint(equalTo: subtitle.bottomAnchor, constant: 20),
            spinner.centerXAnchor.constraint(equalTo: card.centerXAnchor),
            spinner.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -24),
        ])
    }

    // ── Content extraction ────────────────────────────────────────────────────

    private func extractContent() {
        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        var handled = false

        for item in items {
            let providers = item.attachments ?? []
            for provider in providers {
                // 1. Prefer plain text (email body copy, selected text)
                if provider.hasItemConformingToTypeIdentifier("public.plain-text") {
                    handled = true
                    provider.loadItem(forTypeIdentifier: "public.plain-text", options: nil) { [weak self] data, _ in
                        let text = data as? String ?? ""
                        let subject = item.attributedContentText?.string
                        self?.save(text: text, url: nil, subject: subject)
                    }
                    return
                }
                // 2. URL (Safari page share)
                if provider.hasItemConformingToTypeIdentifier("public.url") {
                    handled = true
                    provider.loadItem(forTypeIdentifier: "public.url", options: nil) { [weak self] data, _ in
                        let urlStr = (data as? URL)?.absoluteString ?? (data as? String) ?? ""
                        let subject = item.attributedContentText?.string
                        self?.save(text: nil, url: urlStr, subject: subject)
                    }
                    return
                }
                // 3. Fallback: HTML (rich text email body)
                if provider.hasItemConformingToTypeIdentifier("public.html") {
                    handled = true
                    provider.loadItem(forTypeIdentifier: "public.html", options: nil) { [weak self] data, _ in
                        let html = data as? String ?? ""
                        // Strip tags to get readable text
                        let stripped = html
                            .replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
                            .components(separatedBy: .whitespacesAndNewlines)
                            .filter { !$0.isEmpty }
                            .joined(separator: " ")
                        self?.save(text: stripped.isEmpty ? nil : stripped, url: nil, subject: nil)
                    }
                    return
                }
            }
        }

        if !handled {
            complete()
        }
    }

    // ── Persistence ───────────────────────────────────────────────────────────

    private func save(text: String?, url: String?, subject: String?) {
        var payload: [String: String] = [
            "sharedAt": ISO8601DateFormatter().string(from: Date()),
        ]
        if let t = text,    !t.isEmpty    { payload["text"]    = t }
        if let u = url,     !u.isEmpty    { payload["url"]     = u }
        if let s = subject, !s.isEmpty    { payload["subject"] = s }

        if let defaults = UserDefaults(suiteName: appGroup),
           let data = try? JSONSerialization.data(withJSONObject: payload),
           let json = String(data: data, encoding: .utf8) {
            defaults.set(json, forKey: pendingKey)
            defaults.synchronize()
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
            self?.complete()
        }
    }

    private func complete() {
        DispatchQueue.main.async {
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        }
    }
}
