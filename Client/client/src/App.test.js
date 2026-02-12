import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders in-app analytics dashboard", () => {
  render(<App />);
  const heading = screen.getByText(/inapp analytics/i);
  expect(heading).toBeInTheDocument();
});
