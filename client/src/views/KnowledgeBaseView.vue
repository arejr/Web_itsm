<script setup>
import { computed, onMounted, ref } from 'vue';
import api, { errMsg } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useMetaStore } from '@/stores/meta';
import { useUiStore } from '@/stores/ui';
import EmptyState from '@/components/EmptyState.vue';
import { thDateTime } from '@/services/format';

const auth = useAuthStore();
const meta = useMetaStore();
const ui = useUiStore();

const items = ref([]);
const loading = ref(true);
const search = ref('');
const catFilter = ref('');
const active = ref(null);
const showForm = ref(false);
const draft = ref({ title: '', summary: '', body: '', categoryId: '' });

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/articles');
    items.value = data;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await meta.load();
  draft.value.categoryId = meta.categories[0]?._id || '';
  await load();
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return items.value.filter((a) => {
    if (catFilter.value && a.category?._id !== catFilter.value) return false;
    if (!q) return true;
    return [a.title, a.summary, a.body, a.ref, a.authorName].some((v) => String(v || '').toLowerCase().includes(q));
  });
});

function tint(a) {
  const color = a.category?.color || '#69737b';
  return { background: `${color}1a`, color };
}

async function openArticle(a) {
  active.value = a;
  const { data } = await api.get(`/articles/${a._id}`).catch(() => ({ data: a }));
  active.value = data;
  const i = items.value.findIndex((x) => x._id === data._id);
  if (i >= 0) items.value.splice(i, 1, data);
}

async function createArticle() {
  if (!draft.value.title.trim() || !draft.value.summary.trim()) {
    ui.error('กรุณากรอกหัวข้อและสรุปวิธีแก้ปัญหา');
    return;
  }
  try {
    const { data } = await api.post('/articles', draft.value);
    items.value.unshift(data);
    showForm.value = false;
    draft.value = { title: '', summary: '', body: '', categoryId: meta.categories[0]?._id || '' };
    ui.success(`บันทึกบทความ ${data.ref} เรียบร้อยแล้ว`);
    await load();
  } catch (err) {
    ui.error(errMsg(err));
  }
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div class="d-flex gap-2 flex-wrap align-items-center">
      <input v-model="search" class="input input--sm kb-search" type="search" placeholder="ค้นหาวิธีแก้ปัญหา…" />
      <button class="chip" :class="{ 'is-active': !catFilter }" type="button" @click="catFilter = ''">ทั้งหมด</button>
      <button
        v-for="c in meta.categories"
        :key="c._id"
        type="button"
        class="chip"
        :class="{ 'is-active': catFilter === c._id }"
        @click="catFilter = c._id"
      >
        {{ c.label }}
      </button>
      <div class="flex-fill"></div>
      <button v-if="auth.isStaff" class="btn-brand" type="button" @click="showForm = !showForm">+ เพิ่มบทความ</button>
    </div>

    <div v-if="showForm" class="card-surface p-3 d-flex flex-column gap-2">
      <div class="card-title-xs">บันทึกวิธีแก้ปัญหาใหม่</div>
      <input v-model="draft.title" class="input input--sm" placeholder="หัวข้อปัญหา" />
      <textarea v-model="draft.summary" class="input input--sm" rows="2" placeholder="สรุปวิธีแก้แบบสั้น"></textarea>
      <textarea v-model="draft.body" class="input input--sm" rows="4" placeholder="ขั้นตอนโดยละเอียด"></textarea>
      <select v-model="draft.categoryId" class="input input--sm">
        <option v-for="c in meta.categories" :key="c._id" :value="c._id">{{ c.label }}</option>
      </select>
      <div class="d-flex gap-2">
        <button class="btn-brand" type="button" @click="createArticle">บันทึกบทความ</button>
        <button class="btn-ghost" type="button" @click="showForm = false">ยกเลิก</button>
      </div>
    </div>

    <div v-if="loading" class="kb-grid">
      <div v-for="i in 6" :key="i" class="skeleton" style="height: 160px"></div>
    </div>

    <EmptyState v-else-if="!filtered.length" title="ไม่พบบทความที่ตรงกับเงื่อนไข" sub="ลองเปลี่ยนคำค้นหรือหมวดหมู่" />

    <div v-else class="kb-grid">
      <article
        v-for="a in filtered"
        :key="a._id"
        class="card-surface kb-card"
        role="button"
        tabindex="0"
        @click="openArticle(a)"
        @keydown.enter="openArticle(a)"
      >
        <div class="d-flex align-items-center gap-2">
          <span class="pill" :style="tint(a)">{{ a.category?.label || 'ทั่วไป' }}</span>
          <span class="mono kb-card__ref">{{ a.ref }}</span>
        </div>
        <div class="kb-card__title">{{ a.title }}</div>
        <div class="kb-card__summary">{{ a.summary }}</div>
        <div class="kb-card__foot">
          <span class="flex-fill text-truncate">บันทึกโดย {{ a.authorName || '—' }}</span>
          <span class="mono">ใช้ซ้ำ {{ a.uses }} ครั้ง</span>
        </div>
      </article>
    </div>

    <!-- กล่องอ่านบทความ -->
    <div v-if="active" class="kb-modal" @click.self="active = null">
      <div class="kb-modal__card">
        <div class="d-flex align-items-center gap-2 mb-2">
          <span class="pill" :style="tint(active)">{{ active.category?.label || 'ทั่วไป' }}</span>
          <span class="mono kb-card__ref">{{ active.ref }}</span>
          <div class="flex-fill"></div>
          <button class="kb-modal__close" type="button" aria-label="ปิด" @click="active = null">×</button>
        </div>
        <h2 class="kb-modal__title">{{ active.title }}</h2>
        <p class="kb-modal__summary">{{ active.summary }}</p>
        <div v-if="active.body && active.body !== active.summary" class="kb-modal__body">{{ active.body }}</div>
        <div class="kb-modal__foot">
          บันทึกโดย {{ active.authorName }} · {{ thDateTime(active.createdAt) }} · ใช้ซ้ำ {{ active.uses }} ครั้ง
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kb-search { width: 240px; }
.kb-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: start; }
.kb-card { padding: 17px 18px; display: flex; flex-direction: column; gap: 9px; cursor: pointer; }
.kb-card:hover { box-shadow: 0 6px 18px rgba(16, 24, 32, 0.09); }
.kb-card__ref { font: 400 10.5px var(--font-mono); color: var(--muted-3); }
.kb-card__title { font: 600 13.5px/1.45 var(--font-th); }
.kb-card__summary {
  font: 400 12px/1.65 var(--font-th); color: var(--muted);
  display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.kb-card__foot {
  display: flex; align-items: center; gap: 8px;
  padding-top: 8px; border-top: 1px solid rgba(16, 24, 32, 0.07); margin-top: auto;
  font: 400 11px var(--font-th); color: var(--muted-2);
}

.kb-modal {
  position: fixed; inset: 0; z-index: 1050;
  background: rgba(16, 24, 32, 0.55);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.kb-modal__card {
  width: 100%; max-width: 620px; max-height: 84vh; overflow: auto;
  background: #fff; border-radius: var(--radius-xl); padding: 24px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
}
.kb-modal__close { border: 0; background: transparent; font-size: 24px; line-height: 1; color: var(--muted); cursor: pointer; }
.kb-modal__title { font: 600 20px var(--font-th); letter-spacing: -0.2px; margin: 0 0 10px; }
.kb-modal__summary { font: 400 13.5px/1.9 var(--font-th); color: var(--ink-strong); }
.kb-modal__body { font: 400 13px/1.9 var(--font-th); color: var(--ink-2); white-space: pre-line; padding-top: 8px; border-top: 1px solid var(--line); }
.kb-modal__foot { font: 400 11px var(--font-th); color: var(--muted-3); padding-top: 12px; }

@media (max-width: 1199.98px) { .kb-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 767.98px) { .kb-grid { grid-template-columns: 1fr; } .kb-search { width: 100%; } }
</style>
