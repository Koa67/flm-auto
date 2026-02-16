import type { Metadata } from "next";
import { InverseConfigurator } from "@/components/configurateur/inverse-configurator";

export const metadata: Metadata = {
  title: "Configurateur Inverse",
  description:
    "Trouvez le véhicule idéal en définissant vos critères : budget, famille, usage, motorisation, coffre, confort et priorités. Le configurateur inverse analyse plus de 4 000 générations pour vous proposer les meilleurs choix.",
};

export default function ConfigurateurPage() {
  return <InverseConfigurator />;
}
