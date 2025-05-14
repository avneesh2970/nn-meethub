import logo from "../assests/logo.svg";
import { useAuthStore } from "../store/useAuthStore";
import { LogOut, User } from "lucide-react";
const Navbar = () => {
  const { authUser, logout } = useAuthStore();

  return (
    <header className="bg-base-100 border-b border-base-300 fixed w-full top-0 z-40 backdrop-blur-lg bg-base-100/80">
      <nav className=" flex items-center justify-between p-5 bg-black">
        <img src={logo} alt="Logo" className="h-6 w-auto" />
        {authUser && (
          <div className="flex items-center gap-5">
            <div className={`flex items-center gap-1`}>
              <User className="size-5 text-amber-50" />
              <span className=" sm:inline text-amber-50">
                {authUser.fullName}
              </span>
            </div>
            <button
              className="flex gap-2 items-centre rounded py-1 cursor-pointer transition-all duration-300 
            hover:bg-blue-400 hover:shadow-[0_0_15px_2px_rgba(255,255,255,0.8)] group"
              onClick={logout}
            >
              <LogOut className="size-5  text-white transition-all duration-300 group-hover:text-black" />
              <span className="hidden sm:inline text-white transition-all duration-300 group-hover:text-black">
                Logout
              </span>
            </button>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
