export type PRInfo = {
	number: number;
	title: string;
	mergeCommitSha: string;
	mergedAt: string;
};

export type Session = {
	label: string;
	fromBranch: string;
	toBranch: string;
	promotionBranch: string;
	lastSyncedAt: string | null;
	prs: PRInfo[];
	createdFromBranch: string;
};


