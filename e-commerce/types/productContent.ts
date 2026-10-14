export interface ProductGalleryImage { url: string; alt: string }
export interface SpecificationDefinition {
  key: string;
  label: string;
  format: "TEXT" | "NUMBER" | "SELECT";
  unit: string;
  choices: string[];
}
export interface ProductSpecificationRow { key: string; label: string; value: string }
