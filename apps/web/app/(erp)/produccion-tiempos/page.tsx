import { MockTablePage } from "../mock-table";
import { SCREENS } from "../screens";

export default function Page() {
  return <MockTablePage screen={SCREENS["tiempos"]!} />;
}
