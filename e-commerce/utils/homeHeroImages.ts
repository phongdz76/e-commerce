// Banner-only cutouts. Keep catalog/SKU images and saved CMS revisions intact.
const cutouts: Record<string, string> = Object.fromEntries([
  "macbook-air-silver", "asus-vivobook15-silver", "samsung-galaxy-a55-black", "iphone14-white",
  "samsung-watch6-silver", "apple-watch-se-black", "bose-quietcomfort-black", "imac24-silver",
].map(name => [`/products/${name}.webp`, `/home/banner-${name}.png`]));

export function homeHeroImage(src: string): string {
  return cutouts[src] ?? src;
}
