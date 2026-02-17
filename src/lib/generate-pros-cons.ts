interface ProCon {
  text: string;
  icon: string;
}

export function generateProsCons(data: {
  safetyStars?: number | null;
  powerHp?: number | null;
  trunkVolume?: number | null;
  fuelConsumption?: number | null;
  isofixPoints?: number | null;
  acceleration?: number | null;
  topSpeed?: number | null;
}): { pros: ProCon[]; cons: ProCon[] } {
  const pros: ProCon[] = [];
  const cons: ProCon[] = [];

  // Safety
  if (data.safetyStars != null) {
    if (data.safetyStars >= 5) {
      pros.push({ icon: "\u{1f6e1}\ufe0f", text: "S\u00e9curit\u00e9 exemplaire : 5 \u00e9toiles Euro NCAP" });
    } else if (data.safetyStars >= 4) {
      pros.push({ icon: "\u{1f6e1}\ufe0f", text: `Bonne s\u00e9curit\u00e9 : ${data.safetyStars} \u00e9toiles Euro NCAP` });
    } else if (data.safetyStars <= 2) {
      cons.push({ icon: "\u26a0\ufe0f", text: `S\u00e9curit\u00e9 limit\u00e9e : ${data.safetyStars} \u00e9toile(s) Euro NCAP` });
    }
  }

  // Power
  if (data.powerHp != null) {
    if (data.powerHp >= 300) {
      pros.push({ icon: "\u26a1", text: `Puissance g\u00e9n\u00e9reuse : ${data.powerHp} ch` });
    } else if (data.powerHp >= 200) {
      pros.push({ icon: "\u26a1", text: `Bonne puissance : ${data.powerHp} ch` });
    } else if (data.powerHp < 90) {
      cons.push({ icon: "\ud83d\udc22", text: `Motorisation modeste : ${data.powerHp} ch` });
    }
  }

  // Trunk
  if (data.trunkVolume != null) {
    if (data.trunkVolume >= 500) {
      pros.push({ icon: "\ud83e\uddf3", text: `Coffre g\u00e9n\u00e9reux : ${data.trunkVolume} L` });
    } else if (data.trunkVolume < 250) {
      cons.push({ icon: "\ud83e\uddf3", text: `Coffre limit\u00e9 : ${data.trunkVolume} L` });
    }
  }

  // Family
  if (data.isofixPoints != null && data.isofixPoints >= 3) {
    pros.push({ icon: "\ud83d\udc76", text: `Adapt\u00e9 aux familles : ${data.isofixPoints} points ISOFIX` });
  }

  // Acceleration
  if (data.acceleration != null) {
    if (data.acceleration <= 5) {
      pros.push({ icon: "\ud83c\udfce\ufe0f", text: `Tr\u00e8s rapide : 0-100 en ${data.acceleration}s` });
    } else if (data.acceleration > 12) {
      cons.push({ icon: "\ud83d\udc22", text: `Acc\u00e9l\u00e9ration lente : 0-100 en ${data.acceleration}s` });
    }
  }

  // Top speed
  if (data.topSpeed != null && data.topSpeed >= 280) {
    pros.push({ icon: "\ud83d\ude80", text: `Vitesse max \u00e9lev\u00e9e : ${data.topSpeed} km/h` });
  }

  return { pros: pros.slice(0, 5), cons: cons.slice(0, 4) };
}
