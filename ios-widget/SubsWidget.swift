// ios-widget/SubsWidget.swift
import WidgetKit
import SwiftUI

// MARK: - Constants

private let APP_GROUP       = "group.com.beforeitbills.app"
private let WIDGET_DATA_KEY = "widget_data"

private let ROSE   = Color(hex: "#F43F5E")
private let ROSE_D = Color(hex: "#E11D48")
private let INDIGO = Color(hex: "#6366F1")
private let BG_TOP = Color(hex: "#0F0F1A")
private let BG_BOT = Color(hex: "#1C0A12")

// MARK: - Data model

struct WidgetItem: Identifiable, Codable {
    var id: String
    var name: String
    var amount: Double
    var amountFormatted: String
    var daysUntil: Int
    var nextDate: String   // e.g. "May 3"
    var color: String      // hex e.g. "#E50914"

    var isUrgent: Bool    { daysUntil <= 7 }
    var brandColor: Color { Color(hex: color) }
    var initial: String   { String(name.prefix(1)).uppercased() }
}

struct WidgetData: Codable {
    var upcoming: [WidgetItem]
    var monthlyTotal: Double
    var monthlyTotalFormatted: String
    var yearlyTotal: Double
    var urgentCount: Int
    var activeCount: Int
    var chartMonths: [Double]
    var currency: String
    var updatedAt: String?

    static let placeholder = WidgetData(
        upcoming: [
            WidgetItem(id: "1", name: "Netflix",   amount: 15.99, amountFormatted: "$15.99", daysUntil: 5,  nextDate: "May 3",  color: "#E50914"),
            WidgetItem(id: "2", name: "Spotify",   amount: 9.99,  amountFormatted: "$9.99",  daysUntil: 9,  nextDate: "May 7",  color: "#1DB954"),
            WidgetItem(id: "3", name: "iCloud+",   amount: 2.99,  amountFormatted: "$2.99",  daysUntil: 14, nextDate: "May 12", color: "#0071E3"),
            WidgetItem(id: "4", name: "Notion",    amount: 16.00, amountFormatted: "$16.00", daysUntil: 20, nextDate: "May 18", color: "#444444"),
            WidgetItem(id: "5", name: "1Password", amount: 3.99,  amountFormatted: "$3.99",  daysUntil: 24, nextDate: "May 22", color: "#1A8FE3"),
            WidgetItem(id: "6", name: "Figma",     amount: 12.00, amountFormatted: "$12.00", daysUntil: 30, nextDate: "May 28", color: "#A259FF"),
        ],
        monthlyTotal: 194.45,
        monthlyTotalFormatted: "$194.45",
        yearlyTotal: 2333.40,
        urgentCount: 2,
        activeCount: 8,
        chartMonths: [168, 182, 177, 195, 184, 194.45],
        currency: "USD",
        updatedAt: nil
    )
}

// MARK: - Provider (shared by all widget kinds)

struct SubsProvider: TimelineProvider {
    func placeholder(in _: Context) -> SubsEntry {
        SubsEntry(date: .now, data: .placeholder)
    }

    func getSnapshot(in _: Context, completion: @escaping (SubsEntry) -> Void) {
        completion(SubsEntry(date: .now, data: loadData() ?? .placeholder))
    }

    func getTimeline(in _: Context, completion: @escaping (Timeline<SubsEntry>) -> Void) {
        let entry = SubsEntry(date: .now, data: loadData() ?? .placeholder)
        let next  = Calendar.current.date(byAdding: .hour, value: 1, to: .now) ?? .now
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func loadData() -> WidgetData? {
        guard
            let defaults = UserDefaults(suiteName: APP_GROUP),
            let json     = defaults.string(forKey: WIDGET_DATA_KEY),
            let raw      = json.data(using: .utf8)
        else { return nil }
        return try? JSONDecoder().decode(WidgetData.self, from: raw)
    }
}

struct SubsEntry: TimelineEntry {
    var date: Date
    var data: WidgetData
}

// MARK: - Shared UI atoms

/// Dark glass background with rose + indigo ambient glows
struct WidgetBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [BG_TOP, BG_BOT],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            // Rose glow — top right
            Circle()
                .fill(ROSE.opacity(0.10))
                .frame(width: 160, height: 160)
                .blur(radius: 55)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .offset(x: 50, y: -50)
            // Indigo glow — bottom left
            Circle()
                .fill(INDIGO.opacity(0.08))
                .frame(width: 100, height: 100)
                .blur(radius: 40)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                .offset(x: -30, y: 30)
        }
    }
}

/// Rounded square avatar with brand initial
struct BrandDot: View {
    let item: WidgetItem
    var size: CGFloat = 28

    var body: some View {
        Text(item.initial)
            .font(.system(size: size * 0.4, weight: .black))
            .foregroundColor(.white)
            .frame(width: size, height: size)
            .background(item.brandColor)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
    }
}

/// Uppercase dimmed section label
struct SectionLabel: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(.white.opacity(0.35))
            .tracking(0.8)
    }
}

// MARK: - Small widgets

/// Small A — Monthly Spend
struct SmallSpendView: View {
    let data: WidgetData

    private var wholeStr: String { "\(Int(data.monthlyTotal))" }
    private var centsStr: String {
        let c = Int(((data.monthlyTotal - Double(Int(data.monthlyTotal))) * 100).rounded())
        return String(format: "%02d", min(c, 99))
    }
    private var monthLabel: String { currentMonthLabel() }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                SectionLabel(text: "Monthly")
                Text(monthLabel)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.white.opacity(0.25))
            }

            Spacer()

            VStack(alignment: .leading, spacing: 2) {
                Text("$")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.white.opacity(0.3))
                HStack(alignment: .firstTextBaseline, spacing: 0) {
                    Text(wholeStr)
                        .font(.system(size: 38, weight: .black))
                        .foregroundColor(.white)
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                    Text(".\(centsStr)")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white.opacity(0.5))
                }
                Text("\(data.activeCount) active")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.white.opacity(0.3))
            }

            Spacer()

            HStack(spacing: 2) {
                ForEach(data.upcoming.prefix(6)) { item in
                    RoundedRectangle(cornerRadius: 99)
                        .fill(item.brandColor.opacity(0.7))
                        .frame(height: 4)
                }
            }
        }
        .padding(16)
    }
}

/// Small B — Next Renewal
struct SmallNextView: View {
    let data: WidgetData

    var body: some View {
        Group {
            if let next = data.upcoming.first {
                VStack(alignment: .leading, spacing: 0) {
                    SectionLabel(text: "Next up")

                    Spacer()

                    VStack(alignment: .leading, spacing: 10) {
                        BrandDot(item: next, size: 38)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(next.name)
                                .font(.system(size: 15, weight: .heavy))
                                .foregroundColor(.white)
                                .lineLimit(1)
                            Text(next.amountFormatted)
                                .font(.system(size: 22, weight: .black))
                                .foregroundColor(ROSE)
                                .minimumScaleFactor(0.6)
                                .lineLimit(1)
                            Text("\(next.nextDate) · \(next.daysUntil)d")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(.white.opacity(0.35))
                        }
                    }

                    Spacer()

                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 99)
                                .fill(Color.white.opacity(0.08))
                                .frame(height: 3)
                            let pct = max(0, min(1, 1.0 - Double(next.daysUntil) / 30.0))
                            RoundedRectangle(cornerRadius: 99)
                                .fill(ROSE)
                                .frame(width: geo.size.width * pct, height: 3)
                        }
                    }
                    .frame(height: 3)
                }
                .padding(16)
            } else {
                VStack {
                    Spacer()
                    Text("No upcoming bills")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white.opacity(0.4))
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}

/// Small C — Urgent Count
struct SmallUrgentView: View {
    let data: WidgetData
    private var urgentItems: [WidgetItem] { data.upcoming.filter(\.isUrgent) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(text: "Urgent")

            Spacer()

            VStack(alignment: .leading, spacing: 4) {
                Text("\(data.urgentCount)")
                    .font(.system(size: 58, weight: .black))
                    .foregroundColor(ROSE)
                    .minimumScaleFactor(0.4)
                    .lineLimit(1)
                Text(data.urgentCount == 1 ? "renewal this week" : "renewals this week")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white.opacity(0.45))
            }

            Spacer()

            HStack(spacing: 6) {
                ForEach(urgentItems.prefix(4)) { item in
                    BrandDot(item: item, size: 26)
                }
            }
        }
        .padding(16)
    }
}

// MARK: - Medium widgets

/// Medium A — Spend + Upcoming list
struct MediumSpendListView: View {
    let data: WidgetData

    private var wholeStr: String { "\(Int(data.monthlyTotal))" }
    private var centsStr: String {
        let c = Int(((data.monthlyTotal - Double(Int(data.monthlyTotal))) * 100).rounded())
        return String(format: "%02d", min(c, 99))
    }
    private var monthLabel: String { currentMonthLabel() }

    var body: some View {
        HStack(spacing: 0) {
            // Left — spend summary
            VStack(alignment: .leading, spacing: 0) {
                Text(monthLabel.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.white.opacity(0.35))
                    .tracking(0.8)

                Spacer()

                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline, spacing: 0) {
                        Text("$\(wholeStr)")
                            .font(.system(size: 28, weight: .black))
                            .foregroundColor(.white)
                            .minimumScaleFactor(0.6)
                            .lineLimit(1)
                        Text(".\(centsStr)")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white.opacity(0.45))
                    }
                    Text("/month")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.white.opacity(0.3))
                }

                Spacer()

                VStack(spacing: 2) {
                    ForEach(data.upcoming.prefix(5)) { item in
                        RoundedRectangle(cornerRadius: 99)
                            .fill(item.brandColor.opacity(0.65))
                            .frame(height: 3)
                    }
                }
            }
            .frame(width: 110)
            .padding(.leading, 18)
            .padding(.vertical, 16)

            Rectangle()
                .fill(Color.white.opacity(0.07))
                .frame(width: 1)
                .padding(.vertical, 12)

            // Right — upcoming list
            VStack(alignment: .leading, spacing: 0) {
                SectionLabel(text: "Upcoming")

                Spacer()

                VStack(spacing: 7) {
                    ForEach(data.upcoming.prefix(3)) { item in
                        HStack(spacing: 8) {
                            BrandDot(item: item, size: 24)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(item.name)
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                                Text(item.nextDate)
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundColor(.white.opacity(0.3))
                            }
                            Spacer()
                            Text("$\(Int(item.amount))")
                                .font(.system(size: 12, weight: .heavy))
                                .foregroundColor(item.isUrgent ? ROSE : Color.white.opacity(0.65))
                        }
                    }
                }
            }
            .padding(.leading, 14)
            .padding(.trailing, 18)
            .padding(.vertical, 16)
        }
    }
}

/// Medium B — 6-month spend chart
struct MediumChartView: View {
    let data: WidgetData

    private let labels = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"]
    private var months: [Double] {
        let raw = data.chartMonths.isEmpty
            ? [0, 0, 0, 0, 0, data.monthlyTotal]
            : Array(data.chartMonths.suffix(6))
        let pad = max(0, 6 - raw.count)
        return Array(repeating: 0.0, count: pad) + raw
    }
    private var maxVal: Double { max(months.max() ?? 1, 1) }
    private var changeText: String {
        let prev = months.dropLast().last ?? 0
        let curr = months.last ?? 0
        guard prev > 0 else { return "" }
        return String(format: "%+.1f%%", ((curr - prev) / prev) * 100)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    SectionLabel(text: "6-month spend")
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text("$\(Int(data.monthlyTotal))")
                            .font(.system(size: 22, weight: .black))
                            .foregroundColor(.white)
                        Text("this month")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(.white.opacity(0.35))
                    }
                }
                Spacer()
                if !changeText.isEmpty {
                    Text(changeText)
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundColor(ROSE)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(ROSE.opacity(0.1))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(ROSE.opacity(0.27), lineWidth: 1))
                        .cornerRadius(10)
                }
            }

            Spacer()

            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(months.enumerated()), id: \.offset) { idx, val in
                    let isLast = idx == months.count - 1
                    let barH   = (val / maxVal) * 44 + 4
                    VStack(spacing: 4) {
                        RoundedRectangle(cornerRadius: 5)
                            .fill(
                                isLast
                                    ? AnyShapeStyle(LinearGradient(colors: [ROSE, ROSE_D], startPoint: .top, endPoint: .bottom))
                                    : AnyShapeStyle(Color.white.opacity(0.14))
                            )
                            .frame(height: barH)
                            .shadow(color: isLast ? ROSE.opacity(0.5) : .clear, radius: 6)
                        Text(labels[idx])
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(isLast ? ROSE : Color.white.opacity(0.3))
                            .textCase(.uppercase)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 60)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
    }
}

/// Medium C — Upcoming 2-column grid
struct MediumUpcomingView: View {
    let data: WidgetData
    private var dueTotal: Double { data.upcoming.prefix(4).reduce(0) { $0 + $1.amount } }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: "Upcoming")

            LazyVGrid(
                columns: [GridItem(.flexible()), GridItem(.flexible())],
                spacing: 8
            ) {
                ForEach(data.upcoming.prefix(4)) { item in
                    HStack(spacing: 8) {
                        BrandDot(item: item, size: 30)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(item.name)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                                .lineLimit(1)
                            Text(item.amountFormatted)
                                .font(.system(size: 11, weight: .heavy))
                                .foregroundColor(item.isUrgent ? ROSE : Color.white.opacity(0.55))
                            Text(item.nextDate)
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundColor(.white.opacity(0.25))
                        }
                        Spacer(minLength: 0)
                    }
                }
            }

            HStack {
                Spacer()
                Text("$\(Int(dueTotal)) due soon")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.white.opacity(0.25))
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
    }
}

// MARK: - Large widgets

/// Large A — Full Overview (spend + mini chart + upcoming list)
struct LargeOverviewView: View {
    let data: WidgetData

    private let chartLabels = ["N", "D", "J", "F", "M", "A"]
    private var months: [Double] {
        let raw = data.chartMonths.isEmpty
            ? [0, 0, 0, 0, 0, data.monthlyTotal]
            : Array(data.chartMonths.suffix(6))
        let pad = max(0, 6 - raw.count)
        return Array(repeating: 0.0, count: pad) + raw
    }
    private var maxVal: Double { max(months.max() ?? 1, 1) }

    private var wholeStr: String { "\(Int(data.monthlyTotal))" }
    private var centsStr: String {
        let c = Int(((data.monthlyTotal - Double(Int(data.monthlyTotal))) * 100).rounded())
        return String(format: "%02d", min(c, 99))
    }
    private var yearFloor: Int { Int(data.yearlyTotal) }
    private var yearNum: Int   { Calendar.current.component(.year, from: Date()) }
    private var monthLabel: String { currentMonthLabel() }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(monthLabel.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white.opacity(0.35))
                        .tracking(0.8)
                    HStack(alignment: .firstTextBaseline, spacing: 0) {
                        Text("$\(wholeStr)")
                            .font(.system(size: 38, weight: .black))
                            .foregroundColor(.white)
                            .minimumScaleFactor(0.6)
                            .lineLimit(1)
                        Text(".\(centsStr)")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white.opacity(0.4))
                    }
                    Text("$\(yearFloor) projected for \(yearNum)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.white.opacity(0.3))
                }
                Spacer()
                // Urgent pill
                VStack(spacing: 2) {
                    Text("\(data.urgentCount)")
                        .font(.system(size: 18, weight: .black))
                        .foregroundColor(ROSE)
                    Text("URGENT")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.white.opacity(0.35))
                        .tracking(0.5)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(ROSE.opacity(0.1))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(ROSE.opacity(0.2), lineWidth: 1))
                .cornerRadius(12)
            }
            .padding(.bottom, 6)

            // Mini chart
            HStack(alignment: .bottom, spacing: 5) {
                ForEach(Array(months.enumerated()), id: \.offset) { idx, val in
                    let isLast = idx == months.count - 1
                    let barH   = (val / maxVal) * 44 + 4
                    VStack(spacing: 3) {
                        RoundedRectangle(cornerRadius: 5)
                            .fill(
                                isLast
                                    ? AnyShapeStyle(LinearGradient(colors: [ROSE, ROSE_D], startPoint: .top, endPoint: .bottom))
                                    : AnyShapeStyle(Color.white.opacity(0.13))
                            )
                            .frame(height: barH)
                            .shadow(color: isLast ? ROSE.opacity(0.47) : .clear, radius: 5)
                        Text(chartLabels[idx])
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(isLast ? ROSE : Color.white.opacity(0.28))
                            .textCase(.uppercase)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 52)
            .padding(.bottom, 14)

            // Divider
            Rectangle()
                .fill(Color.white.opacity(0.07))
                .frame(height: 1)
                .padding(.bottom, 14)

            // Upcoming list
            VStack(alignment: .leading, spacing: 10) {
                SectionLabel(text: "Upcoming")
                VStack(spacing: 0) {
                    ForEach(data.upcoming.prefix(5)) { item in
                        HStack(spacing: 10) {
                            BrandDot(item: item, size: 28)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(item.name)
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                                Text(item.nextDate)
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundColor(.white.opacity(0.3))
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 1) {
                                Text(item.amountFormatted)
                                    .font(.system(size: 13, weight: .heavy))
                                    .foregroundColor(.white)
                                Text("\(item.daysUntil)d")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(item.isUrgent ? ROSE : Color.white.opacity(0.3))
                            }
                        }
                        .padding(.bottom, 10)
                    }
                }
            }

            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.top, 18)
        .padding(.bottom, 10)
    }
}

/// Large B — 30-day Timeline
struct LargeTimelineView: View {
    let data: WidgetData

    private var items: [WidgetItem] { Array(data.upcoming.prefix(6)) }
    private var total: Double       { items.reduce(0) { $0 + $1.amount } }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 4) {
                SectionLabel(text: "Next 30 days")
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("$\(Int(total))")
                        .font(.system(size: 26, weight: .black))
                        .foregroundColor(.white)
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                    Text("due")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white.opacity(0.3))
                }
            }
            .padding(.bottom, 14)

            // Timeline entries
            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.offset) { idx, item in
                    HStack(alignment: .top, spacing: 12) {
                        // Spine
                        VStack(spacing: 0) {
                            Circle()
                                .fill(item.isUrgent ? ROSE : Color.white.opacity(0.25))
                                .frame(width: 8, height: 8)
                                .padding(.top, 2)
                            if idx < items.count - 1 {
                                Rectangle()
                                    .fill(Color.white.opacity(0.07))
                                    .frame(width: 1)
                                    .padding(.top, 2)
                            }
                        }
                        .frame(width: 18)

                        // Content
                        HStack {
                            HStack(spacing: 8) {
                                BrandDot(item: item, size: 26)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(item.name)
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundColor(.white)
                                        .lineLimit(1)
                                    Text(item.nextDate)
                                        .font(.system(size: 10, weight: .medium))
                                        .foregroundColor(.white.opacity(0.3))
                                }
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 1) {
                                Text(item.amountFormatted)
                                    .font(.system(size: 13, weight: .heavy))
                                    .foregroundColor(item.isUrgent ? ROSE : .white)
                                Text("\(item.daysUntil)d")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(item.isUrgent ? ROSE.opacity(0.6) : Color.white.opacity(0.25))
                            }
                        }
                        .padding(.bottom, idx < items.count - 1 ? 8 : 0)
                    }
                }
            }

            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.top, 18)
        .padding(.bottom, 10)
    }
}

// MARK: - Widget entry views (route by family)

/// Spend Overview — Small: Spend  ·  Medium: SpendList  ·  Large: Overview
struct OverviewWidgetView: View {
    let entry: SubsEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            WidgetBackground()
            switch family {
            case .systemSmall:  SmallSpendView(data: entry.data)
            case .systemMedium: MediumSpendListView(data: entry.data)
            default:            LargeOverviewView(data: entry.data)
            }
        }
    }
}

/// Upcoming Renewals — Small: NextRenewal  ·  Medium: UpcomingGrid  ·  Large: Timeline
struct UpcomingWidgetView: View {
    let entry: SubsEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            WidgetBackground()
            switch family {
            case .systemSmall:  SmallNextView(data: entry.data)
            case .systemMedium: MediumUpcomingView(data: entry.data)
            default:            LargeTimelineView(data: entry.data)
            }
        }
    }
}

/// Spend Insights — Small: UrgentCount  ·  Medium: Chart
struct InsightsWidgetView: View {
    let entry: SubsEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            WidgetBackground()
            switch family {
            case .systemSmall: SmallUrgentView(data: entry.data)
            default:           MediumChartView(data: entry.data)
            }
        }
    }
}

// MARK: - Widget configurations

struct BIBOverviewWidget: Widget {
    let kind = "BIBOverviewWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SubsProvider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                OverviewWidgetView(entry: entry)
                    .containerBackground(BG_TOP, for: .widget)
            } else {
                OverviewWidgetView(entry: entry)
            }
        }
        .configurationDisplayName("Spend Overview")
        .description("Monthly spend summary and upcoming renewals.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct BIBUpcomingWidget: Widget {
    let kind = "BIBUpcomingWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SubsProvider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                UpcomingWidgetView(entry: entry)
                    .containerBackground(BG_TOP, for: .widget)
            } else {
                UpcomingWidgetView(entry: entry)
            }
        }
        .configurationDisplayName("Upcoming Renewals")
        .description("See what's renewing next, in timeline or grid view.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct BIBInsightsWidget: Widget {
    let kind = "BIBInsightsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SubsProvider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                InsightsWidgetView(entry: entry)
                    .containerBackground(BG_TOP, for: .widget)
            } else {
                InsightsWidgetView(entry: entry)
            }
        }
        .configurationDisplayName("Spend Insights")
        .description("Urgent alerts and 6-month spend trend.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Helpers

private func currentMonthLabel() -> String {
    let fmt = DateFormatter()
    fmt.dateFormat = "MMM yyyy"
    return fmt.string(from: Date())
}

extension Color {
    init(hex: String) {
        let h   = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let int = UInt64(h, radix: 16) ?? 0
        let r   = Double((int >> 16) & 0xFF) / 255
        let g   = Double((int >> 8) & 0xFF) / 255
        let b   = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
