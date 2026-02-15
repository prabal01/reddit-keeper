interface FilterBarProps {
    minScore: number | undefined;
    maxDepth: number | undefined;
    skipDeleted: boolean;
    opOnly: boolean;
    topN: number | undefined;
    onChange: (filters: FilterState) => void;
}

export interface FilterState {
    minScore: number | undefined;
    maxDepth: number | undefined;
    skipDeleted: boolean;
    opOnly: boolean;
    topN: number | undefined;
}

export function FilterBar({
    minScore,
    maxDepth,
    skipDeleted,
    opOnly,
    topN,
    onChange,
}: FilterBarProps) {
    const update = (partial: Partial<FilterState>) => {
        onChange({
            minScore,
            maxDepth,
            skipDeleted,
            opOnly,
            topN,
            ...partial,
        });
    };

    return (
        <div className="filter-bar" role="toolbar" aria-label="Comment filters">
            <div className="filter-group">
                <label htmlFor="filter-min-score" className="filter-label">
                    Min Score
                </label>
                <input
                    id="filter-min-score"
                    type="number"
                    className="filter-input"
                    placeholder="—"
                    value={minScore ?? ""}
                    onChange={(e) =>
                        update({
                            minScore: e.target.value
                                ? parseInt(e.target.value)
                                : undefined,
                        })
                    }
                    aria-label="Minimum comment score"
                />
            </div>

            <div className="filter-group">
                <label htmlFor="filter-max-depth" className="filter-label">
                    Max Depth
                </label>
                <input
                    id="filter-max-depth"
                    type="number"
                    className="filter-input"
                    placeholder="—"
                    min={0}
                    value={maxDepth ?? ""}
                    onChange={(e) =>
                        update({
                            maxDepth: e.target.value
                                ? parseInt(e.target.value)
                                : undefined,
                        })
                    }
                    aria-label="Maximum comment nesting depth"
                />
            </div>

            <div className="filter-group">
                <label htmlFor="filter-top-n" className="filter-label">
                    Top N
                </label>
                <input
                    id="filter-top-n"
                    type="number"
                    className="filter-input"
                    placeholder="—"
                    min={1}
                    value={topN ?? ""}
                    onChange={(e) =>
                        update({
                            topN: e.target.value
                                ? parseInt(e.target.value)
                                : undefined,
                        })
                    }
                    aria-label="Show only top N root comments"
                />
            </div>

            <div className="filter-group filter-toggle">
                <label className="toggle-label">
                    <input
                        type="checkbox"
                        checked={skipDeleted}
                        onChange={(e) =>
                            update({ skipDeleted: e.target.checked })
                        }
                        aria-label="Skip deleted comments"
                    />
                    <span className="toggle-text">Skip Deleted</span>
                </label>
            </div>

            <div className="filter-group filter-toggle">
                <label className="toggle-label">
                    <input
                        type="checkbox"
                        checked={opOnly}
                        onChange={(e) =>
                            update({ opOnly: e.target.checked })
                        }
                        aria-label="Show only comments by original poster"
                    />
                    <span className="toggle-text">OP Only</span>
                </label>
            </div>
        </div>
    );
}
