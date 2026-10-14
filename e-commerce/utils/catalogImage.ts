export function isCatalogImageUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2000) {
    return false;
  }
  if (/^\/products\/[a-z0-9_-]+\.(webp|png|jpe?g|gif)$/i.test(value)) {
    return true;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      [
        "res.cloudinary.com",
        "firebasestorage.googleapis.com",
        "m.media-amazon.com",
        "images.unsplash.com",
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
