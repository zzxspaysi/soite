import { test } from "node:test";
import assert from "node:assert/strict";
import { roundPrice, formatMoney } from "../lib/money.mjs";

test("unit prices round to whole rubles before quantities are multiplied", () => {
  assert.equal(roundPrice(null), null);
  assert.equal(roundPrice(12907067), 12907100);
  assert.equal(roundPrice(11527934), 11527900);
  assert.equal(roundPrice(12574450), 12574500);
  assert.equal(roundPrice(2600000), 2600000);
  assert.equal(roundPrice(12907067) * 3, 38721300);
});

test("money labels have no kopecks and unknown prices remain requests", () => {
  assert.equal(formatMoney(null), "Цена по запросу");
  assert.equal(formatMoney(12907067).replace(/\s/g, ""), "129071₽");
  assert.equal(formatMoney(11527934).replace(/\s/g, ""), "115279₽");
  assert.equal(formatMoney(0).replace(/\s/g, ""), "0₽");
});
