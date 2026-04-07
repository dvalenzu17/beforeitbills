// ios-widget/SubsWidget.swift
import WidgetKit
import SwiftUI

// MARK: - Data model

private let APP_GROUP = "group.com.beforeitbills.app"
private let WIDGET_DATA_KEY = "widget_data"

struct WidgetItem: Identifiable, Codable {
  var id: String
  var name: String
  var amount: String
  var daysUntil: Int
}

struct WidgetData: Codable {
  var upcoming: [WidgetItem]
  var monthlyTotal: String

  static let placeholder = WidgetData(
    upcoming: [
      WidgetItem(id: "1", name: "Netflix", amount: "$15.99", daysUntil: 3),
      WidgetItem(id: "2", name: "Spotify", amount: "$9.99",  daysUntil: 12),
      WidgetItem(id: "3", name: "Hulu",    amount: "$17.99", daysUntil: 21),
    ],
    monthlyTotal: "$43.97"
  )
}

// MARK: - Provider

struct SubsProvider: TimelineProvider {
  func placeholder(in _: Context) -> SubsEntry {
    SubsEntry(date: .now, data: .placeholder)
  }

  func getSnapshot(in _: Context, completion: @escaping (SubsEntry) -> Void) {
    completion(SubsEntry(date: .now, data: loadData() ?? .placeholder))
  }

  func getTimeline(in _: Context, completion: @escaping (Timeline<SubsEntry>) -> Void) {
    let entry = SubsEntry(date: .now, data: loadData() ?? .placeholder)
    // Refresh every hour
    let next = Calendar.current.date(byAdding: .hour, value: 1, to: .now) ?? .now
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func loadData() -> WidgetData? {
    guard
      let defaults = UserDefaults(suiteName: APP_GROUP),
      let json = defaults.string(forKey: WIDGET_DATA_KEY),
      let data = json.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(WidgetData.self, from: data)
  }
}

struct SubsEntry: TimelineEntry {
  var date: Date
  var data: WidgetData
}

// MARK: - Views

struct SubsWidgetView: View {
  var entry: SubsEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    switch family {
    case .systemSmall:  SmallView(entry: entry)
    case .systemMedium: MediumView(entry: entry)
    default:            LargeView(entry: entry)
    }
  }
}

// Small: monthly total + next due
struct SmallView: View {
  var entry: SubsEntry
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("BeforeItBills")
        .font(.system(size: 10, weight: .bold))
        .foregroundColor(Color(hex: "#7DD3FC"))
      Spacer()
      if let first = entry.data.upcoming.first {
        Text(first.name)
          .font(.system(size: 14, weight: .bold))
          .foregroundColor(.white)
          .lineLimit(1)
        Text(first.amount)
          .font(.system(size: 13))
          .foregroundColor(.white)
        Text(daysLabel(first.daysUntil))
          .font(.system(size: 11))
          .foregroundColor(Color(hex: "#8090B0"))
      } else {
        Text("No bills soon")
          .font(.system(size: 12))
          .foregroundColor(Color(hex: "#8090B0"))
      }
      Spacer()
      Text("\(entry.data.monthlyTotal)/mo")
        .font(.system(size: 10))
        .foregroundColor(Color(hex: "#8090B0"))
    }
    .padding(12)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .background(Color(hex: "#0E1320"))
  }
}

// Medium: 2-3 rows
struct MediumView: View {
  var entry: SubsEntry
  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      // Header
      HStack {
        Text("BeforeItBills")
          .font(.system(size: 11, weight: .bold))
          .foregroundColor(Color(hex: "#7DD3FC"))
        Spacer()
        Text("\(entry.data.monthlyTotal)/mo")
          .font(.system(size: 11))
          .foregroundColor(Color(hex: "#8090B0"))
      }
      .padding(.horizontal, 14)
      .padding(.top, 12)
      .padding(.bottom, 8)

      Divider().background(Color(hex: "#1E2A40"))

      if entry.data.upcoming.isEmpty {
        Spacer()
        Text("No upcoming bills")
          .font(.system(size: 12))
          .foregroundColor(Color(hex: "#8090B0"))
          .frame(maxWidth: .infinity)
        Spacer()
      } else {
        ForEach(entry.data.upcoming.prefix(3)) { item in
          HStack {
            Text(item.name)
              .font(.system(size: 13, weight: .bold))
              .foregroundColor(.white)
              .lineLimit(1)
            Spacer()
            Text(daysLabel(item.daysUntil))
              .font(.system(size: 11))
              .foregroundColor(Color(hex: "#8090B0"))
              .padding(.trailing, 8)
            Text(item.amount)
              .font(.system(size: 12))
              .foregroundColor(.white)
          }
          .padding(.horizontal, 14)
          .frame(maxHeight: .infinity)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color(hex: "#0E1320"))
  }
}

// Large: up to 5 rows
struct LargeView: View {
  var entry: SubsEntry
  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack {
        Text("BeforeItBills")
          .font(.system(size: 12, weight: .bold))
          .foregroundColor(Color(hex: "#7DD3FC"))
        Spacer()
        Text("\(entry.data.monthlyTotal)/mo")
          .font(.system(size: 12))
          .foregroundColor(Color(hex: "#8090B0"))
      }
      .padding(.horizontal, 16)
      .padding(.top, 14)
      .padding(.bottom, 10)

      Divider().background(Color(hex: "#1E2A40"))

      if entry.data.upcoming.isEmpty {
        Spacer()
        Text("No upcoming bills")
          .font(.system(size: 13))
          .foregroundColor(Color(hex: "#8090B0"))
          .frame(maxWidth: .infinity)
        Spacer()
      } else {
        ForEach(entry.data.upcoming.prefix(5)) { item in
          HStack {
            Text(item.name)
              .font(.system(size: 14, weight: .bold))
              .foregroundColor(.white)
              .lineLimit(1)
            Spacer()
            Text(daysLabel(item.daysUntil))
              .font(.system(size: 12))
              .foregroundColor(Color(hex: "#8090B0"))
              .padding(.trailing, 10)
            Text(item.amount)
              .font(.system(size: 13))
              .foregroundColor(.white)
          }
          .padding(.horizontal, 16)
          .padding(.vertical, 10)

          Divider()
            .background(Color(hex: "#1E2A40"))
            .padding(.horizontal, 16)
        }
        Spacer()
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .background(Color(hex: "#0E1320"))
  }
}

// MARK: - Helpers

private func daysLabel(_ days: Int) -> String {
  switch days {
  case ...0: return "today"
  case 1:    return "1d"
  default:   return "\(days)d"
  }
}

extension Color {
  init(hex: String) {
    let hex = hex.trimmingCharacters(in: .init(charactersIn: "#"))
    let int = UInt64(hex, radix: 16) ?? 0
    let r = Double((int >> 16) & 0xFF) / 255
    let g = Double((int >> 8) & 0xFF) / 255
    let b = Double(int & 0xFF) / 255
    self.init(red: r, green: g, blue: b)
  }
}

// MARK: - Widget

struct SubsWidget: Widget {
  let kind = "SubsWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SubsProvider()) { entry in
      SubsWidgetView(entry: entry)
        .containerBackground(Color(hex: "#0E1320"), for: .widget)
    }
    .configurationDisplayName("Upcoming Bills")
    .description("See your next subscriptions and bills at a glance.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
