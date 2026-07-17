// src/utils/provinces.js — v3.7
//
// 中国省级行政区的**规范全名**（34 个）。这是省份的真值源：热力图 / 按省筛选靠
// `volunteer.province` 与前端地图 GeoJSON（`frontend/public/china-100000.json`）里的
// 省名**精确匹配**，所以省份必须是全名（"辽宁省" 而非 "辽宁"）才能匹配上。
// CSV 导入的省份规范性校验用这个列表。改了要和 GeoJSON 保持一致。

export const CHINA_PROVINCES = [
  '北京市', '天津市', '河北省', '山西省', '内蒙古自治区',
  '辽宁省', '吉林省', '黑龙江省',
  '上海市', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
  '河南省', '湖北省', '湖南省', '广东省', '广西壮族自治区', '海南省',
  '重庆市', '四川省', '贵州省', '云南省', '西藏自治区',
  '陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区',
  '台湾省', '香港特别行政区', '澳门特别行政区',
];

const PROVINCE_SET = new Set(CHINA_PROVINCES);

export const isValidProvince = (name) => PROVINCE_SET.has(String(name ?? '').trim());
