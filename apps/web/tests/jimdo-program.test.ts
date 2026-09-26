import assert from "node:assert/strict";
import test from "node:test";
import { JimdoProgramError, parseJimdoProgram } from "../lib/jimdo-program";

const programMarkup = `
  <h3>NEXT SHOW - 19.09. | 19.00 UHR</h3>
  <div class="j-module n j-textWithImage"><img src="https://image.jimcdn.com/next-show.png" alt="" /><p><strong>OPEN BAR</strong></p><p>mit DJ THEKENSCHLAMPE und KARAOKE</p><script>// Jimdo-Modulkonfiguration</script></div>
  <h3>COMING UP</h3>
  <div id="cc-m-one" class="j-module n j-text "><p><strong>26.09. OPEN BAR<br/></strong>drinks and mixed music</p></div>
  <div id="cc-m-two" class="j-module n j-text "><p><strong>03.10. BRANDON WOLFE -</strong> <a href="https://rausgegangen.de/events/brandon-wolfe/?ref=bonanzbar&amp;source=homepage">TICKET</a></p><p>crossover rock n´ roll</p></div>
  <h2>HIGHLIGHTS</h2>
`;

test("übernimmt das Jimdo-Programm mit Ticket-Links und Text", () => {
  const events = parseJimdoProgram(programMarkup, new Date("2026-09-26T10:00:00.000Z"));

  assert.equal(events.length, 3);
  assert.deepEqual(events[0], {
    id: "jimdo-2026-09-19-0-open-bar",
    title: "OPEN BAR",
    description: "mit DJ THEKENSCHLAMPE und KARAOKE",
    ticketUrl: null,
    imageUrl: "https://image.jimcdn.com/next-show.png",
    startsAt: "2026-09-19T12:00:00.000Z",
    sourceDateLabel: "19.09. · 19:00 Uhr",
  });
  assert.equal(events[2].title, "BRANDON WOLFE");
  assert.equal(events[2].description, "crossover rock n´ roll");
  assert.equal(events[2].ticketUrl, "https://rausgegangen.de/events/brandon-wolfe/?ref=bonanzbar&source=homepage");
  assert.equal(events[2].sourceDateLabel, "03.10.");
});

test("lehnt HTML ohne erkennbaren Programmabschnitt ab", () => {
  assert.throws(() => parseJimdoProgram("<h1>Bonanzbar</h1>"), JimdoProgramError);
});
