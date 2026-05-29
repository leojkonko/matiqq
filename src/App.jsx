import { useEffect } from 'react';
import { body, title } from './matiqPageSource';
import { initializeMatiqSite } from './siteBehavior';
import './matiq-site.css';

export default function App() {
  useEffect(() => {
    document.title = title;

    return initializeMatiqSite();
  }, []);

  return (
    <div className="site-shell">
      <div className="site-canvas" dangerouslySetInnerHTML={{ __html: body }} />
    </div>
  );
}