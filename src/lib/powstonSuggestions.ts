export type PowstonSuggestion = {
  label: string;
  detail?: string;
  documentation?: string;
  insertText?: string;
  kind?: "variable" | "function" | "constant" | "property" | "class";
};

export const powstonBaseSuggestions: PowstonSuggestion[] = [
  { label: "interval_time", detail: "datetime", documentation: "Current billing interval timestamp." },
  { label: "timezone_str", detail: "string", documentation: "System timezone." },
  { label: "location", detail: "LocationInfo", documentation: "Contains name, region, timezone, latitude, longitude." },
  { label: "sunrise", detail: "datetime", documentation: "Daily sunrise time." },
  { label: "sunset", detail: "datetime", documentation: "Daily sunset time." },
  { label: "current_hour", detail: "integer", documentation: "Current hour from interval_time." },
  { label: "solar_power", detail: "float", documentation: "Current solar generation (W)." },
  { label: "grid_power", detail: "float", documentation: "Current grid power flow (W)." },
  { label: "house_power", detail: "float", documentation: "Household power consumption (W)." },
  { label: "battery_soc", detail: "float", documentation: "Battery state of charge (%)." },
  { label: "battery_capacity", detail: "float", documentation: "Total battery capacity (Wh)." },
  { label: "rrp", detail: "float", documentation: "Reference retail price ($/MWh)." },
  { label: "buy_price", detail: "float", documentation: "Current buy price (c/kWh)." },
  { label: "sell_price", detail: "float", documentation: "Current sell price (c/kWh)." },
  { label: "buy_forecast", detail: "list", documentation: "Future buy prices (8 hours ahead)." },
  { label: "sell_forecast", detail: "list", documentation: "Future sell prices (8 hours ahead)." },
  { label: "forecast", detail: "list", documentation: "RRP forecast ($/MWh)." },
  { label: "history_buy_prices", detail: "list", documentation: "Historical buy price data." },
  { label: "general_tariff", detail: "float", documentation: "General electricity tariff (c/kWh)." },
  { label: "feed_in_tariff", detail: "float", documentation: "Feed-in tariff rate (c/kWh)." },
  { label: "weather_data", detail: "dict", documentation: "Complete weather forecast data." },
  { label: "cloud_cover", detail: "float", documentation: "Current cloud cover percentage." },
  { label: "hourly_gti_forecast", detail: "list", documentation: "Hourly GTI forecast (W/m²)." },
  { label: "gti_today", detail: "float", documentation: "Total GTI forecast for today." },
  { label: "gti_past", detail: "float", documentation: "GTI accumulated so far today." },
  { label: "gti_to_2pm", detail: "float", documentation: "GTI forecast until 2 PM." },
  { label: "gti_sum_tomorrow", detail: "float", documentation: "Tomorrow's total GTI forecast." },
  { label: "hours_until_midnight", detail: "integer", documentation: "Hours remaining until midnight." },
  { label: "optimal_charging", detail: "integer", documentation: "Charging optimization setting." },
  { label: "optimal_discharging", detail: "integer", documentation: "Discharging optimization setting." },
  { label: "import_soc", detail: "float", documentation: "SOC threshold for import operations." },
  { label: "feed_in_power_limitation", detail: "Optional[float]", documentation: "Export power limit (W)." },
  { label: "always_export_rrp", detail: "Optional[float]", documentation: "RRP threshold for auto-export ($/MWh)." },
  { label: "threshold_1", detail: "float", documentation: "ML model threshold 1." },
  { label: "threshold_2", detail: "float", documentation: "ML model threshold 2." },
  { label: "threshold_3", detail: "float", documentation: "ML model threshold 3." },
  { label: "threshold_4", detail: "float", documentation: "ML model threshold 4." },
  { label: "threshold_5", detail: "float", documentation: "ML model threshold 5." },
  { label: "confidence_1", detail: "float", documentation: "ML model confidence 1." },
  { label: "confidence_2", detail: "float", documentation: "ML model confidence 2." },
  { label: "confidence_3", detail: "float", documentation: "ML model confidence 3." },
  { label: "confidence_4", detail: "float", documentation: "ML model confidence 4." },
  { label: "confidence_5", detail: "float", documentation: "ML model confidence 5." },
  { label: "last_action", detail: "string", documentation: "Previous system action." },
  { label: "action_pattern", detail: "list", documentation: "Recent action history." },
  { label: "action_method", detail: "string", documentation: "How action was determined." },
  { label: "reason", detail: "string", documentation: "Current action reasoning." },
  { label: "APP_VERSION", detail: "string", documentation: "Application version." },
  { label: "serial_number", detail: "string", documentation: "Inverter serial number." },
  { label: "manufacturer", detail: "string", documentation: "Inverter manufacturer." },
  { label: "product_name", detail: "string", documentation: "Inverter product name." },
  { label: "site_name", detail: "string", documentation: "Site display name." },
  { label: "site_id", detail: "integer", documentation: "Unique site identifier." },
  { label: "state", detail: "string", documentation: "Australian state." },
  { label: "inverter_id", detail: "integer", documentation: "Inverter identifier." },
  { label: "user_code_id", detail: "integer", documentation: "User script identifier." },
  { label: "user_code_name", detail: "string", documentation: "User script name." },
  { label: "hybrid", detail: "boolean", documentation: "Hybrid inverter capability." },
  { label: "data_logger", detail: "boolean", documentation: "Data logging enabled." },
  { label: "api_only", detail: "boolean", documentation: "API-only operation mode." },
  { label: "use_api", detail: "boolean", documentation: "Use API for control." },
  { label: "use_local", detail: "boolean", documentation: "Use local control." },
  { label: "read_only", detail: "boolean", documentation: "Read-only mode." },
  { label: "lv_quality", detail: "string", documentation: "Live data quality indicator." },
  { label: "lv_time", detail: "datetime", documentation: "Last live data timestamp." },
  { label: "lv_buy_price", detail: "float", documentation: "Last valid buy price." },
  { label: "lv_sell_price", detail: "float", documentation: "Last valid sell price." },
  { label: "user_cache", detail: "dict", documentation: "User-specific cached data." },
  { label: "meter_df", detail: "dict", documentation: "Meter reading data." },
  { label: "last_days_df", detail: "dict", documentation: "Historical daily data." },
  { label: "inverters", detail: "dict", documentation: "Multi-inverter data collection." },
  { label: "site_statistics", detail: "dict", documentation: "Site performance statistics." },
  { label: "inverter_statistics", detail: "dict", documentation: "Inverter performance statistics." },
  { label: "mqtt_data", detail: "dict", documentation: "MQTT sensor data from Home Assistant." },
  { label: "runtime_params", detail: "dict", documentation: "Runtime configuration parameters." },
  { label: "night_reserve", detail: "float", documentation: "Required battery reserve for overnight (%)." },
  { label: "first_good_gti", detail: "integer", documentation: "First hour with good solar irradiance." },
  { label: "last_good_gti", detail: "integer", documentation: "Last hour with good solar irradiance." },
  { label: "is_solar_window_now", detail: "boolean", documentation: "Whether currently in productive solar window." },
  { label: "is_daytime", detail: "boolean", documentation: "Whether between sunrise and sunset." },
  { label: "soc_surplus", detail: "float", documentation: "Battery SOC above night reserve (%)." },
  { label: "time_left", detail: "float", documentation: "Hours remaining until sunrise/sunset." },
  { label: "projected_deficit", detail: "float", documentation: "Projected SOC deficit by morning (%)." },
  { label: "decisions", detail: "DecisionLogger", documentation: "Structured decision logging object." },
  {
    label: "decisions.reason",
    detail: "DecisionLogger",
    documentation: "Log a decision with priority and optional context.",
    insertText:
      "decisions.reason('${1:action}', '${2:reason}', priority=${3:2})",
    kind: "function"
  },
  {
    label: "decisions.reasons",
    detail: "DecisionLogger",
    documentation: "Collection of logged decision entries.",
    kind: "property"
  },
  { label: "BATTERY_SOC_NEEDED", detail: "constant", documentation: "Minimum SOC (%) required overnight." },
  { label: "BAD_SUN_DAY_KEEP_SOC", detail: "constant", documentation: "Extra SOC (%) held if poor solar forecast." },
  { label: "GOOD_SUN_DAY", detail: "constant", documentation: "Threshold for GTI sum (in 100s of W/m²)." },
  { label: "GOOD_SUN_HOUR", detail: "constant", documentation: "Per-hour GTI threshold (in 10s of W/m²)." }
];

export const toUniqueSuggestions = (suggestions: PowstonSuggestion[]) => {
  const seen = new Set<string>();
  return suggestions.filter((entry) => {
    if (seen.has(entry.label)) {
      return false;
    }
    seen.add(entry.label);
    return true;
  });
};
