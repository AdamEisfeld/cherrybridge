export type PRInfo = {
	number: number;
	title: string;
	mergeCommitSha: string;
	mergedAt: string;
};

export type PRInfoWithDetails = PRInfo & {
	headRefName?: string;
	body?: string;
};


