export const PROVINCES_API = {
  BASE: "https://provinces.open-api.vn/api",
  GET_ALL: "https://provinces.open-api.vn/api/p/",
  GET_PROVINCE: (code: string | number) =>
    `https://provinces.open-api.vn/api/p/${code}?depth=2`,
  GET_DISTRICT: (code: string | number) =>
    `https://provinces.open-api.vn/api/d/${code}?depth=2`,
  GET_WARD: (code: string | number) =>
    `https://provinces.open-api.vn/api/w/${code}?depth=2`,
};
