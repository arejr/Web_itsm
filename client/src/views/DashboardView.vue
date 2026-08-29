<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useTicketStore } from '@/stores/tickets';
import { minutesText } from '@/services/format';
import PriorityBadge from '@/components/PriorityBadge.vue';
import EmptyState from '@/components/EmptyState.vue';

const router = useRouter();
const auth = useAuthStore();
const tickets = useTicketStore();

const data = ref(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const [{ data: stats }] = await Promise.all([api.get('/stats/dashboard'), tickets.load()]);
    data.value = stats;
  } finally {
    loading.value = false;
  }
});

const kpis = computed(() => {
  const k = data.value?.kpis;
  if (!k) return [];
  return [
    { label: 'ตั๋วงานเปิดอยู่', value: String(k.open), sub: `จากทั้งหมด ${k.totalThisMonth} ใบเดือนนี้`,
      pct: Math.min(100, Math.round((k.open / Math.max(1, k.totalThisMonth)) * 100)), bar: '#14776b' },
    { label: 'อัตราแก้ปัญหาสำเร็จ', value: `${k.successRate}%`, sub: `ปิดสำเร็จ ${k.resolvedThisMonth} ใบเดือนนี้`,
      pct: k.successRate, bar: '#6cb33f' },
    { label: 'เวลาตอบกลับเฉลี่ย', value: minutesText(k.avgResponseMinutes), sub: 'นับจากเวลาแจ้งถึงเริ่มดำเนินการ',
      pct: Math.min(100, Math.round((k.avgResponseMinutes / 240) * 100)), bar: '#7b5cd6' },
    { label: 'เกินกำหนดเดือนนี้', value: String(k.breachedThisMonth), sub: 'ตั๋วที่ปิดช้ากว่าเวลาที่กำหนด',
      pct: Math.min(100, Math.round((k.breachedThisMonth / Math.max(1, k.totalThisMonth)) * 100)), bar: '#c0392b' }
  ];
});

// ความสูงของแท่งกราฟ (สูงสุด 140px)
const chartMax = computed(() => Math.max(1, ...(data.value?.chart || []).flatMap((d) => [d.in, d.out])));
function barHeight(v) {
  return `${Math.max(v > 0 ? 4 : 1, Math.round((v / chartMax.value) * 140))}px`;
}

const catStats = computed(() => data.value?.catStats || []);
const slaRisk = computed(() => data.value?.slaRisk || []);

function open(t) {
  router.push({ name: 'ticket-detail', params: { id: t._id } });
}
</script>

<template>
  <div class="d-flex flex-column gap-3 gap-xl-4">
    <!-- KPI -->
    <div class="kpi-grid">
      <template v-if="loading">
        <div v-for="i in 4" :key="i" class="skeleton" style="height: 108px"></div>
      </template>
      <div v-for="k in kpis" v-else :key="k.label" class="card-surface kpi">
        <div class="kpi__label">{{ k.label }}</div>
        <div class="d-flex align-items-end gap-2">
          <span class="kpi__value">{{ k.value }}</span>
        </div>
        <div class="meter"><span :style="{ width: k.pct + '%', background: k.bar }"></span></div>
        <div class="kpi__sub">{{ k.sub }}</div>
      </div>
    </div>

    <!-- กราฟ + สัดส่วนหมวดหมู่ -->
    <div class="charts-grid">
      <div class="card-surface p-3 p-xl-4">
        <div class="d-flex align-items-baseline gap-2 flex-wrap mb-1">
          <div class="card-title-sm">ปริมาณตั๋วงาน 14 วันล่าสุด</div>
          <div class="chart-legend">
            <span><i style="background: #14776b"></i>แจ้งเข้า</span>
            <span><i style="background: #7fc9a2"></i>ปิดงาน</span>
          </div>
        </div>
        <div class="chart">
          <div v-for="(d, i) in data?.chart || []" :key="i" class="chart__col">
            <div class="chart__bars">
              <div class="chart__bar" :style="{ height: barHeight(d.in), background: '#14776b' }" :title="`แจ้งเข้า ${d.in}`"></div>
              <div class="chart__bar" :style="{ height: barHeight(d.out), background: '#7fc9a2' }" :title="`ปิดงาน ${d.out}`"></div>
            </div>
            <span class="chart__day mono">{{ d.day }}</span>
          </div>
        </div>
      </div>

      <div class="card-surface p-3 p-xl-4 d-flex flex-column gap-3">
        <div class="card-title-sm">สัดส่วนตามหมวดหมู่ปัญหา</div>
        <EmptyState v-if="!catStats.length && !loading" title="ยังไม่มีข้อมูลหมวดหมู่" />
        <div v-for="c in catStats" :key="c.key" class="d-flex flex-column gap-2">
          <div class="d-flex justify-content-between align-items-center">
            <span style="font: 400 12px var(--font-th); color: var(--ink-2)">{{ c.label }}</span>
            <span class="mono" style="font-size: 11.5px; color: var(--muted)">{{ c.count }} ใบ · {{ c.percent }}%</span>
          </div>
          <div class="meter meter--lg"><span :style="{ width: Math.max(2, c.percent) + '%', background: c.color }"></span></div>
        </div>
      </div>
    </div>

    <!-- ตั๋วที่ใกล้เกินกำหนด -->
    <div class="card-surface card-surface--flush">
      <div class="card-head">
        <div class="card-title-sm">ตั๋วงานที่ใกล้เกินกำหนด</div>
        <span class="pill pill--mono" style="background: #fdecec; color: #a12626">{{ slaRisk.length }} รายการ</span>
        <div class="flex-fill"></div>
        <RouterLink v-if="!auth.isEmployee" :to="{ name: 'queue' }" class="btn-ghost">ดูคิวทั้งหมด</RouterLink>
      </div>

      <EmptyState v-if="!slaRisk.length" title="ไม่มีตั๋วงานที่ใกล้เกินกำหนด" sub="ทุกงานยังอยู่ในเวลาที่กำหนด" />

      <button v-for="t in slaRisk" :key="t._id" type="button" class="row-btn sla-row" @click="open(t)">
        <span class="tag-code">{{ t.code }}</span>
        <span class="sla-row__title text-truncate">{{ t.title }}</span>
        <PriorityBadge :value="t.priority" />
        <span class="sla-row__assignee text-truncate">{{ t.assigneeName }}</span>
        <span class="sla-row__sla mono" :class="{ 'is-late': (t.slaMinutes ?? 0) < 0 }">{{ t.slaText }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.kpi { padding: 16px 17px; display: flex; flex-direction: column; gap: 9px; }
.kpi__label { font: 500 11.5px var(--font-th); color: var(--muted); }
.kpi__value { font: 600 27px var(--font-th); letter-spacing: -0.6px; line-height: 1; }
.kpi__sub { font: 400 11px var(--font-th); color: var(--muted-3); }

.charts-grid { display: grid; grid-template-columns: 1.55fr 1fr; gap: 14px; align-items: start; }
.chart-legend { display: flex; gap: 12px; font: 400 11.5px var(--font-th); color: var(--muted-2); }
.chart-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; }
.chart { display: flex; align-items: flex-end; gap: 9px; height: 178px; padding-top: 14px; }
.chart__col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
.chart__bars { display: flex; align-items: flex-end; gap: 3px; height: 140px; width: 100%; justify-content: center; }
.chart__bar { width: 38%; border-radius: 3px 3px 0 0; min-height: 2px; }
.chart__day { font: 400 9.5px var(--font-mono); color: var(--muted-3); }

.sla-row {
  display: grid;
  grid-template-columns: 130px 1fr 96px 130px 110px;
  align-items: center; gap: 14px;
  border-top: 1px solid var(--line-2); border-bottom: 0;
  padding: 13px 20px;
}
.sla-row__title { font: 500 13px var(--font-th); }
.sla-row__assignee { font: 400 12px var(--font-th); color: var(--muted); }
.sla-row__sla { justify-self: end; font: 500 11.5px var(--font-mono); color: var(--warn-ink); }
.sla-row__sla.is-late { color: var(--danger-ink); }

@media (max-width: 1199.98px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .charts-grid { grid-template-columns: 1fr; }
}
@media (max-width: 767.98px) {
  .sla-row { grid-template-columns: 1fr auto; grid-template-areas: 'code prio' 'title title' 'assignee sla'; gap: 6px 10px; }
  .sla-row > :nth-child(1) { grid-area: code; }
  .sla-row > :nth-child(2) { grid-area: title; }
  .sla-row > :nth-child(3) { grid-area: prio; justify-self: end; }
  .sla-row > :nth-child(4) { grid-area: assignee; }
  .sla-row > :nth-child(5) { grid-area: sla; }
  .chart { gap: 4px; }
}
@media (max-width: 480px) {
  .kpi-grid { grid-template-columns: 1fr; }
}
</style>
