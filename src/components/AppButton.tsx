import classNames from "classnames";
import { HTMLAttributes } from "react";

export const AppButton: React.FC<HTMLAttributes<HTMLButtonElement>> = ({children, className, ...params}) => {
    return <button className={classNames(className, "AppButton")} {...params}>
        {children}
    </button>
}