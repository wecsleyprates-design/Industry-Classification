import { api } from "@/lib/api";
import {
	type GetArticleResponse,
	type GetArticlesProps,
} from "@/lib/types/article";

export const getArticles = async (
	params: GetArticlesProps,
): Promise<GetArticleResponse> => {
	const { search, page } = params;
	const { data } = await api.get<GetArticleResponse>(
		`https://newsdata.io/api/1/news?q=${search ?? ""}&page=${page}`,
	);
	return data;
};
