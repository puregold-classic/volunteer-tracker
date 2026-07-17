// frontend/src/lib/provinces.ts — v3.7
//
// 中国省级行政区规范全名（34 个），镜像后端 backend/src/utils/provinces.js，
// 二者都对齐首页地图 GeoJSON（public/china-100000.json）的省名。规范＝全名
// （"辽宁省" 而非 "辽宁"），因为热力图/按省筛选靠 volunteer.province 精确匹配。
// 建档/编辑表单的省份下拉用它做选项，从源头防止填错/填短名。

export const CHINA_PROVINCES = [
  '北京市', '天津市', '河北省', '山西省', '内蒙古自治区',
  '辽宁省', '吉林省', '黑龙江省',
  '上海市', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
  '河南省', '湖北省', '湖南省', '广东省', '广西壮族自治区', '海南省',
  '重庆市', '四川省', '贵州省', '云南省', '西藏自治区',
  '陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区',
  '台湾省', '香港特别行政区', '澳门特别行政区',
] as const;

// 中国大陆下拉选项：排除台湾省（台湾有独立 region），保留港澳
// （没有独立 region，港澳志愿者归在大陆 + 对应特别行政区省份）。
export const MAINLAND_PROVINCES = CHINA_PROVINCES.filter((p) => p !== '台湾省');

export const TAIWAN_PROVINCE = '台湾省';
