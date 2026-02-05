import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MasteryRadarChart, type RadarChartDataPoint } from "@/components/mastery/mastery-radar-chart";

describe("MasteryRadarChart", () => {
  it("should render empty state when no valid data provided", () => {
    const emptyData: RadarChartDataPoint[] = [];
    render(<MasteryRadarChart data={emptyData} />);
    
    expect(screen.getByText(/no mastery data available/i)).toBeInTheDocument();
  });

  it("should render empty state when all data points have null mastery_level_order", () => {
    const invalidData: RadarChartDataPoint[] = [
      {
        competency_id: "comp-1",
        competency_name: "Test Competency",
        mastery_level_order: null,
        mastery_level_label: null,
      },
    ];
    render(<MasteryRadarChart data={invalidData} />);
    
    expect(screen.getByText(/no mastery data available/i)).toBeInTheDocument();
  });

  it("should render chart when valid data is provided", () => {
    const validData: RadarChartDataPoint[] = [
      {
        competency_id: "comp-1",
        competency_name: "Test Competency 1",
        mastery_level_order: 3,
        mastery_level_label: "Proficient",
      },
      {
        competency_id: "comp-2",
        competency_name: "Test Competency 2",
        mastery_level_order: 2,
        mastery_level_label: "Developing",
      },
    ];
    
    const { container } = render(<MasteryRadarChart data={validData} />);
    
    // Check that SVG is rendered
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    
    // Check that competency names are rendered
    expect(screen.getByText("Test Competency 1")).toBeInTheDocument();
    expect(screen.getByText("Test Competency 2")).toBeInTheDocument();
  });

  it("should filter out invalid data points", () => {
    const mixedData: RadarChartDataPoint[] = [
      {
        competency_id: "comp-1",
        competency_name: "Valid Competency",
        mastery_level_order: 3,
        mastery_level_label: "Proficient",
      },
      {
        competency_id: "comp-2",
        competency_name: "Invalid Competency",
        mastery_level_order: null,
        mastery_level_label: null,
      },
    ];
    
    const { container } = render(<MasteryRadarChart data={mixedData} />);
    
    // Should render chart with only valid data
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(screen.getByText("Valid Competency")).toBeInTheDocument();
    expect(screen.queryByText("Invalid Competency")).not.toBeInTheDocument();
  });
});
