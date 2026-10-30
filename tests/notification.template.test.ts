import { renderTemplate } from "../src/services/notification/template.service";

describe("notification template rendering", () => {
  it("renders both handlebars and dollar placeholders", () => {
    const body = "Hello ${student_name} at {{time}} on ${date}";

    expect(
      renderTemplate(body, {
        student_name: "Jane",
        time: "08:30",
        date: "08/07/2026"
      })
    ).toBe("Hello Jane at 08:30 on 08/07/2026");
  });

  it("normalizes escaped newlines and HTML entities for SMS", () => {
    const body = "Education Care\\nAttendance: Mukunzi&#x20;Cedorc\\nDate: 23/08/2026";

    expect(renderTemplate(body)).toBe(
      "Education Care\nAttendance: Mukunzi Cedorc\nDate: 23/08/2026"
    );
  });
});
