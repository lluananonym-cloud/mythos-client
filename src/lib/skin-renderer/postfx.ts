// Mythos: Der Promo-Umriss (Outline-Shader) des NoRisk-Renderers wird nicht nachgebaut.
// Der Typ bleibt, damit die Aufrufer unverändert kompilieren; die Werte werden ignoriert.
export interface PromoOutlineConfig {
  enabled: boolean;
  color: string;
  strength: number;
  thickness: number;
  sensitivity: number;
}
