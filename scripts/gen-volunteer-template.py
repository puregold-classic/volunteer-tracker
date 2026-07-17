import xlsxwriter, os

import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'public', 'volunteer-import-template.xlsx')

DEPTS = [
    ('口译项目管理','KY_PROJECT'), ('笔译项目管理','BY_PROJECT'), ('特殊项目管理部','SPECIAL_PROJECT'),
    ('XZT项目管理部','XZT'), ('口译培训','KY_TRAINING'), ('笔译培训','BY_TRAINING'),
    ('笔译考核','BY_EXAM'), ('共读会','READING_CLUB'), ('支援管理部','MGMT'), ('技术部','TECH'),
    ('推广部','PROMO'), ('人文关怀部','CARE'), ('视频部','VIDEO'), ('文档管理部','DOCS'), ('网络技术部','NET_TECH'),
]
PROVINCES = ['北京市','天津市','河北省','山西省','内蒙古自治区','辽宁省','吉林省','黑龙江省','上海市','江苏省',
    '浙江省','安徽省','福建省','江西省','山东省','河南省','湖北省','湖南省','广东省','广西壮族自治区','海南省',
    '重庆市','四川省','贵州省','云南省','西藏自治区','陕西省','甘肃省','青海省','宁夏回族自治区','新疆维吾尔自治区',
    '台湾省','香港特别行政区','澳门特别行政区']
REGIONS = ['中国大陆','中国台湾','东南亚','美国','欧洲','其他']
STATUSES = ['在职','不在职']
ROLES = ['user','b_admin','a_admin']

HEADERS = ['中文姓名','英文姓名','状态','地区','省份','部门','邮箱','手机号','生日','角色']
EXAMPLES = [
    ['张三','Zhang San','在职','中国大陆','辽宁省','网络技术部','zhangsan@example.com','13800138000','1990-05-20','user'],
    ['李四','','在职','中国大陆','广东省','技术部','lisi@example.com','','','user'],
]

wb = xlsxwriter.Workbook(OUT)
f_req  = wb.add_format({'bold':True,'font_color':'#FFFFFF','bg_color':'#C0392B','border':1,'align':'center','valign':'vcenter'})
f_cond = wb.add_format({'bold':True,'font_color':'#FFFFFF','bg_color':'#E67E22','border':1,'align':'center','valign':'vcenter'})
f_opt  = wb.add_format({'bold':True,'font_color':'#FFFFFF','bg_color':'#2980B9','border':1,'align':'center','valign':'vcenter'})
f_ex   = wb.add_format({'font_color':'#7F8C8D','italic':True,'border':1})
f_cell = wb.add_format({'border':1})
f_title= wb.add_format({'bold':True,'font_size':13})
f_h2   = wb.add_format({'bold':True,'bg_color':'#ECF0F1','border':1})
f_wrap = wb.add_format({'text_wrap':True,'valign':'top','border':1})
f_note = wb.add_format({'text_wrap':True,'valign':'top','align':'left','bg_color':'#FEF9E7','border':1,'font_color':'#7D6608'})
f_red  = wb.add_format({'font_color':'#C0392B','italic':True})
f_opth = wb.add_format({'bold':True,'bg_color':'#D6EAF8','border':1,'align':'center'})

# add sheets in the order they should appear (填写表在最前)
ws  = wb.add_worksheet('志愿者名单')
doc = wb.add_worksheet('填写说明')

# ── 填写说明 先填（这样能拿到可选值区域的单元格范围给下拉引用）──
doc.set_column(0,0,14); doc.set_column(1,1,16); doc.set_column(2,2,54)
doc.set_column(4,7,14)
r = 0
doc.write(r,0,'各列填写说明',f_title); r+=1
doc.write(r,0,'列名',f_h2); doc.write(r,1,'必填?',f_h2); doc.write(r,2,'说明 / 可选值',f_h2); r+=1
rules=[
 ('中文姓名','必填','志愿者中文姓名'),
 ('英文姓名','选填','拼音或英文名，可留空'),
 ('状态','选填','在职 / 不在职（留空默认 在职）'),
 ('地区','选填','中国大陆 / 中国台湾 / 东南亚 / 美国 / 欧洲 / 其他（留空默认 其他）'),
 ('省份','大陆/台湾必填','必须规范全名：如"辽宁省"不能写"辽宁"；台湾填"台湾省"；海外可留空。名单表已做下拉'),
 ('部门','必填','填部门中文全名（见下方对照表）或英文 id；名单表已做下拉'),
 ('邮箱','必填','登录账号，需唯一（不能和已有账号重复）'),
 ('手机号','选填','11 位手机号，可留空'),
 ('生日','选填','格式 YYYY-MM-DD（如 1990-05-20），可留空；填了则用生日制 ID，不填用 PG-流水号'),
 ('角色','选填','user / b_admin / a_admin（留空默认 user；一般志愿者填 user）'),
]
for a,b,c in rules:
    doc.write(r,0,a,f_cell); doc.write(r,1,b,f_cell); doc.write(r,2,c,f_wrap); r+=1
r+=1
doc.write(r,0,'部门对照表（填中文名即可，名单表下拉直接选）',f_title); r+=1
doc.write(r,0,'部门中文名',f_h2); doc.write(r,1,'id',f_h2); r+=1
dept_start=r
for n,idv in DEPTS:
    doc.write(r,0,n,f_cell); doc.write(r,1,idv,f_cell); r+=1
dept_end=r-1
r+=1
# ── 可选值参考（罗列到最后）——同时作为下拉数据源 ──
doc.write(r,0,'可选值参考（名单表下拉已内置这些值）',f_title); r+=1
opt_hdr=r
for c,t in enumerate(['地区','状态','角色','省份']):
    doc.write(r,c,t,f_opth)
r+=1
opt_start=r
maxlen=max(len(REGIONS),len(STATUSES),len(ROLES),len(PROVINCES))
for i in range(maxlen):
    if i<len(REGIONS):   doc.write(opt_start+i,0,REGIONS[i],f_cell)
    if i<len(STATUSES):  doc.write(opt_start+i,1,STATUSES[i],f_cell)
    if i<len(ROLES):     doc.write(opt_start+i,2,ROLES[i],f_cell)
    if i<len(PROVINCES): doc.write(opt_start+i,3,PROVINCES[i],f_cell)

def rng(col, start, n):  # 0-indexed col/row → A1 绝对范围
    from xlsxwriter.utility import xl_range_abs
    return "='填写说明'!" + xl_range_abs(start, col, start+n-1, col)
SRC_REGION = rng(0, opt_start, len(REGIONS))
SRC_STATUS = rng(1, opt_start, len(STATUSES))
SRC_ROLE   = rng(2, opt_start, len(ROLES))
SRC_PROV   = rng(3, opt_start, len(PROVINCES))
SRC_DEPT   = rng(0, dept_start, len(DEPTS))

# ── 志愿者名单（第一个 sheet，打开即见）──
ws.activate()
ws.freeze_panes(1,0)
hdr_fmt={0:f_req,1:f_opt,2:f_opt,3:f_opt,4:f_cond,5:f_req,6:f_req,7:f_opt,8:f_opt,9:f_opt}
for c,h in enumerate(HEADERS): ws.write(0,c,h,hdr_fmt[c])
for c,w in enumerate([10,12,7,10,16,14,24,13,12,9]): ws.set_column(c,c,w)
for ri,row in enumerate(EXAMPLES, start=1):
    for c,v in enumerate(row): ws.write(ri,c,v,f_ex)
ws.write(len(EXAMPLES)+1,0,'↑ 上面两行是示例，录入前请删除或替换成真实数据',f_red)
LAST=500
ws.data_validation(1,2,LAST,2,{'validate':'list','source':SRC_STATUS})
ws.data_validation(1,3,LAST,3,{'validate':'list','source':SRC_REGION})
ws.data_validation(1,4,LAST,4,{'validate':'list','source':SRC_PROV})
ws.data_validation(1,5,LAST,5,{'validate':'list','source':SRC_DEPT})
ws.data_validation(1,9,LAST,9,{'validate':'list','source':SRC_ROLE})
# 旁边两点批注（表格右侧）
ws.set_column(11,14,15)
ws.merge_range('L1:O5',
    '📌 填写提示\n'
    '1. 生日、手机号 为非必填，可留空\n'
    '2. 详细填写规则、部门 / 地区 / 省份可选值 → 见「填写说明」页\n'
    '（表头：红=必填  橙=大陆/台湾必填  蓝=选填）',
    f_note)
ws.set_row(0,22)

wb.close()
print('wrote', OUT, os.path.getsize(OUT), 'bytes | dept', SRC_DEPT, '| prov', SRC_PROV)
