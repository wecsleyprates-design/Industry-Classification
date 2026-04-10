import { useQuery } from "@tanstack/react-query";
import {
	type GetArticleResponse,
	type GetArticlesProps,
} from "@/lib/types/article";
import { getArticles } from "../api/article.service";

export const useArticlesQuery = (params: GetArticlesProps) =>
	useQuery<GetArticleResponse>({
		queryKey: ["getArticles", { params }],
		queryFn: async () => {
			const res = await getArticles(params);
			return res;
		},
	});
