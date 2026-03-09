export async function invalidateOpenAlexMembershipQueries(queryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['libraryArticleIds'] }),
    queryClient.invalidateQueries({ queryKey: ['collectionArticleIds'] }),
  ])
}
