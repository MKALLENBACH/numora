import { BrandLogo } from "@/components/ui/BrandLogo";
import { primaryNavigation, siteConfig } from "@/config/site";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container site-footer__top">
        <div className="site-footer__identity">
          <a href="#inicio" aria-label="NUMORA — voltar ao início">
            <BrandLogo />
          </a>
          <p>Transformação Operacional Inteligente.</p>
        </div>

        <nav className="site-footer__navigation" aria-label="Navegação do rodapé">
          {primaryNavigation.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
          <a href="#diagnostico">Próximo passo</a>
        </nav>
      </div>

      <div className="container site-footer__bottom">
        <p>© {currentYear} NUMORA. Todos os direitos reservados.</p>
        {siteConfig.legalLinks.length > 0 ? (
          <nav aria-label="Informações legais">
            {siteConfig.legalLinks.map((item) => (
              <a href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}
      </div>
    </footer>
  );
}
