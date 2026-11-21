package helpers

import (
	"net/http/httptest"
	"testing"

	"github.com/muety/wakapi/models"
	"github.com/stretchr/testify/assert"
)

func TestParseSummaryFilters_SingleBranch(t *testing.T) {
	req := httptest.NewRequest("GET", "/?branch=master", nil)
	f := ParseSummaryFilters(req)
	assert.Equal(t, 1, f.CountByType(models.SummaryBranch))
	assert.True(t, f.Branch.MatchAny("master"))
	assert.False(t, f.Branch.MatchAny("other"))
}

func TestParseSummaryFilters_MultipleBranches(t *testing.T) {
	// multi-select: repeated params + a blank value that must be ignored
	req := httptest.NewRequest("GET", "/?branch=master&branch=ZVNK-1&branch=", nil)
	f := ParseSummaryFilters(req)
	assert.Equal(t, 2, f.CountByType(models.SummaryBranch))
	assert.True(t, f.Branch.MatchAny("master"))
	assert.True(t, f.Branch.MatchAny("ZVNK-1"))
	assert.False(t, f.Branch.MatchAny("develop"))
}

func TestParseSummaryFilters_NoBranch(t *testing.T) {
	req := httptest.NewRequest("GET", "/?project=cabinet", nil)
	f := ParseSummaryFilters(req)
	assert.Equal(t, 0, f.CountByType(models.SummaryBranch))
}
