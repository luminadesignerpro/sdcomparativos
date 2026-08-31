import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-display font-bold text-primary">404</h1>
        <p className="text-xl text-muted-foreground mt-4">Página não encontrada</p>
        <Link to="/">
          <Button variant="gradient" className="mt-6">
            <Home className="w-4 h-4 mr-2" />
            Voltar ao início
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
