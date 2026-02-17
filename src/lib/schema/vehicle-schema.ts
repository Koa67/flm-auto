/**
 * Schema.org structured data generator for vehicle (Car) pages.
 * Produces JSON-LD compliant with https://schema.org/Car
 */

interface VehicleBrand {
  name: string;
}

interface VehicleModel {
  name: string;
}

interface VehicleGeneration {
  name: string;
  production_start: string | null;
  production_end: string | null;
  slug: string;
}

interface VehicleVariant {
  name: string;
  fuel_type: string | null;
  power_hp: number | null;
  torque_nm: number | null;
  displacement_cc: number | null;
  transmission: string | null;
  drivetrain: string | null;
}

interface SafetyRating {
  stars: number | null;
  overall_rating: number | null;
}

interface InteriorDims {
  trunk_volume_liters: number | null;
}

interface VehicleImage {
  url: string;
}

export interface VehicleSchemaInput {
  brand: VehicleBrand;
  model: VehicleModel;
  generation: VehicleGeneration;
  variants: VehicleVariant[];
  safety: SafetyRating | null;
  interiorDims: InteriorDims | null;
  images: VehicleImage[];
}

/** Map common fuel type strings to Schema.org fuel type URLs */
function mapFuelType(fuel: string | null): string | undefined {
  if (!fuel) return undefined;
  const normalized = fuel.toLowerCase().trim();
  if (normalized.includes("diesel")) return "https://schema.org/DieselFuel";
  if (normalized.includes("electr") || normalized === "ev" || normalized === "bev")
    return "https://schema.org/Electricity";
  if (
    normalized.includes("petrol") ||
    normalized.includes("gasoline") ||
    normalized.includes("essence") ||
    normalized === "gas"
  )
    return "https://schema.org/Gasoline";
  if (normalized.includes("hybrid") && normalized.includes("plug"))
    return "https://schema.org/Electricity";
  if (normalized.includes("hybrid")) return "https://schema.org/Gasoline";
  if (normalized.includes("lpg") || normalized.includes("gpl"))
    return "https://schema.org/Gasoline";
  if (normalized.includes("cng") || normalized.includes("gnv"))
    return "https://schema.org/NaturalGas";
  if (normalized.includes("hydrogen") || normalized.includes("fcev"))
    return "https://schema.org/Electricity";
  return undefined;
}

/** Map transmission type strings to Schema.org values */
function mapTransmission(
  transmission: string | null
): string | undefined {
  if (!transmission) return undefined;
  const norm = transmission.toLowerCase().trim();
  if (
    norm.includes("auto") ||
    norm.includes("dct") ||
    norm.includes("dsg") ||
    norm.includes("cvt") ||
    norm.includes("tiptronic") ||
    norm.includes("pdk") ||
    norm.includes("s-tronic") ||
    norm.includes("at") ||
    norm.includes("robotis")
  )
    return "https://schema.org/AutomaticTransmission";
  if (norm.includes("manual") || norm.includes("mt") || norm.includes("manuelle"))
    return "https://schema.org/ManualTransmission";
  return undefined;
}

/** Map drivetrain/drive_type strings to Schema.org values */
function mapDriveWheelConfiguration(
  drive: string | null
): string | undefined {
  if (!drive) return undefined;
  const norm = drive.toLowerCase().trim();
  if (
    norm.includes("awd") ||
    norm.includes("4wd") ||
    norm.includes("all-wheel") ||
    norm.includes("quattro") ||
    norm.includes("xdrive") ||
    norm.includes("4x4") ||
    norm.includes("4motion") ||
    norm.includes("integral") ||
    norm.includes("all wheel")
  )
    return "https://schema.org/AllWheelDriveConfiguration";
  if (
    norm.includes("fwd") ||
    norm.includes("front-wheel") ||
    norm.includes("front wheel") ||
    norm.includes("traction")
  )
    return "https://schema.org/FrontWheelDriveConfiguration";
  if (
    norm.includes("rwd") ||
    norm.includes("rear-wheel") ||
    norm.includes("rear wheel") ||
    norm.includes("propulsion")
  )
    return "https://schema.org/RearWheelDriveConfiguration";
  return undefined;
}

function getYear(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const year = new Date(dateStr).getFullYear();
  return Number.isFinite(year) ? year : null;
}

/**
 * Generates Schema.org JSON-LD structured data for a vehicle page.
 * Only includes fields that have valid values (no undefined/null leaking).
 */
export function generateVehicleSchema(input: VehicleSchemaInput): Record<string, unknown> {
  const { brand, model, generation, variants, safety, interiorDims, images } = input;
  const fullName = `${brand.name} ${model.name} ${generation.name}`;
  const modelYear = getYear(generation.production_start);
  const primaryVariant = variants[0] ?? null;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: fullName,
    brand: {
      "@type": "Brand",
      name: brand.name,
    },
    model: model.name,
  };

  // Model date (production year)
  if (modelYear) {
    schema.vehicleModelDate = String(modelYear);
  }

  // Production date range
  if (generation.production_start) {
    schema.productionDate = generation.production_start;
  }

  // Images
  const imageUrls = images
    .map((img) => img.url)
    .filter(Boolean)
    .slice(0, 10);
  if (imageUrls.length > 0) {
    schema.image = imageUrls.length === 1 ? imageUrls[0] : imageUrls;
  }

  // Engine (from the first/most powerful variant)
  if (primaryVariant) {
    const engine: Record<string, unknown> = {
      "@type": "EngineSpecification",
    };

    const fuelType = mapFuelType(primaryVariant.fuel_type);
    if (fuelType) {
      engine.fuelType = fuelType;
    }

    if (primaryVariant.displacement_cc) {
      engine.engineDisplacement = {
        "@type": "QuantitativeValue",
        value: primaryVariant.displacement_cc,
        unitCode: "CMQ",
      };
    }

    if (primaryVariant.power_hp) {
      engine.enginePower = {
        "@type": "QuantitativeValue",
        value: primaryVariant.power_hp,
        unitText: "hp",
      };
    }

    if (primaryVariant.torque_nm) {
      engine.torque = {
        "@type": "QuantitativeValue",
        value: primaryVariant.torque_nm,
        unitCode: "N1",
        unitText: "Nm",
      };
    }

    // Only add engine if it has at least one property beyond @type
    if (Object.keys(engine).length > 1) {
      schema.vehicleEngine = engine;
    }

    // Transmission
    const transmission = mapTransmission(primaryVariant.transmission);
    if (transmission) {
      schema.vehicleTransmission = transmission;
    }

    // Drive wheel configuration
    const driveConfig = mapDriveWheelConfiguration(primaryVariant.drivetrain);
    if (driveConfig) {
      schema.driveWheelConfiguration = driveConfig;
    }
  }

  // Safety rating (Euro NCAP stars)
  if (safety?.stars != null) {
    schema.vehicleSpecialUsage = undefined; // clear if accidentally set
    schema.additionalProperty = [
      {
        "@type": "PropertyValue",
        name: "Euro NCAP Safety Rating",
        value: `${safety.stars}/5`,
      },
    ];
  }

  // Cargo volume
  if (interiorDims?.trunk_volume_liters) {
    schema.cargoVolume = {
      "@type": "QuantitativeValue",
      value: interiorDims.trunk_volume_liters,
      unitCode: "LTR",
      unitText: "litres",
    };
  }

  // Number of engine variants as additional property
  if (variants.length > 1) {
    const existing = (schema.additionalProperty as Record<string, unknown>[]) || [];
    existing.push({
      "@type": "PropertyValue",
      name: "Available Engine Variants",
      value: variants.length,
    });
    schema.additionalProperty = existing;
  }

  // Clean up: remove any undefined values
  delete schema.vehicleSpecialUsage;

  return schema;
}
