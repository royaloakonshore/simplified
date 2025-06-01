type PageParams = {
  id: string;
};

type SearchParams = { [key: string]: string | string[] | undefined };

type BOMPageProps = {
  params: Promise<PageParams>;
  searchParams?: Promise<SearchParams>; // searchParams is now also a Promise
};

// @ts-ignore TODO: Resolve PageProps constraint issue - Keeping temporarily if the Promise fix isn't complete
export default async function ViewBillOfMaterialPage({ params: paramsPromise, searchParams: searchParamsPromise }: BOMPageProps) {
  const params = await paramsPromise;
  const searchParams = searchParamsPromise ? await searchParamsPromise : undefined; // Await searchParams if it exists
  const bomId = params.id;

  // TODO: Fetch BOM data using bom.get({ id: bomId, companyId: '...' })
  // For now, just display the ID for testing the build

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">View Bill of Material</h1>
      <div className="p-4 border rounded-lg bg-card text-card-foreground">
        <p>BOM ID: {bomId}</p>
        {searchParams && Object.keys(searchParams).length > 0 && (
          <p>Search Params: {JSON.stringify(searchParams)}</p>
        )}
        {/* Placeholder for where BOM details would go */}
      </div>
    </div>
  );
} 