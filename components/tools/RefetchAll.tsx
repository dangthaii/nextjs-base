import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";

export const RefetchAll = () => {
  const queryClient = useQueryClient();

  const invalidateAllQueries = () => {
    queryClient.invalidateQueries();
  };

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <Button
      variant="outline"
      className="fixed right-[10px] top-[20%] z-10"
      onClick={invalidateAllQueries}
    >
      Fetch
    </Button>
  );
};
