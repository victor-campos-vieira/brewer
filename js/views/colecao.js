import { $ } from '../utils.js';
import { renderCafeView } from './cafe.js';

/* ---------- COLEÇÃO (Exclusivamente a Cafeteria Customizável) ---------- */
export function renderColecao(){
  var colTab = $('#tab-colecao');
  if (!colTab) return;
  renderCafeView(colTab);
}
