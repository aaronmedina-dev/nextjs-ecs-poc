'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from '../styles/Home.module.css';

const Home: React.FC = () => {
    const [apiParam, setApiParam] = useState('');
    const [staticData, setStaticData] = useState<{ title: string; description: string } | null>(null);
    const router = useRouter();

    const handleRedirect = () => {
        if (apiParam.trim()) {
            router.push(`/api/hello?name=${encodeURIComponent(apiParam)}`);
        }
    };

    const bucketUrl = 'https://<bucket-url>.s3.<region>.amazonaws.com';

    useEffect(() => {
      fetch(`${bucketUrl}/static/data.json`)
          .then((response) => {
              if (!response.ok) {
                  throw new Error(`HTTP error! Status: ${response.status}`);
              }
              return response.json();
          })
          .then((data) => setStaticData(data))
          .catch((error) => console.error('Error fetching static data:', error));
    }, []);
  

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>{staticData?.title || 'Loading....'}</h1>
                <p>{staticData?.description || 'Fetching static data....'}</p>
                <br />
                <p>Title and Description loaded from <a href={`${bucketUrl}/static/data.json`}>data.json in S3</a></p>
            </header>

            <main className={styles.main}>
                <section className={styles.imageComparison}>
                    <h2>Image Optimisation Example</h2>
                    <p>
                        Below is an example of Next.js image optimisation: the same image
                        rendered at <strong>different quality levels</strong>.
                    </p>
                    <div className={styles.imageContainer}>
                        <div>
                            <Image
                                src={`${bucketUrl}/assets/test-ecs.png`}
                                alt="Optimised Image (Quality: 1)"
                                width={500}
                                quality={1}
                                className={styles.image}
                            />
                            <p>Width:500 Quality: 1</p>
                        </div>
                        <div>
                            <Image
                                src={`${bucketUrl}/assets/test-ecs.png`}
                                alt="Optimised Image (Quality: 100)"
                                width={500}
                                quality={100}
                                className={styles.image}
                            />
                            <p>Width:500 Quality: 100</p>
                        </div>
                    </div>
                </section>

                <section className={styles.links}>
                    <h2>Explore More</h2>
                    <p>
                        <label htmlFor="apiParam" className={styles.label}>
                            API Demo. Enter a parameter to test API route:
                        </label>
                        <input
                            type="text"
                            id="apiParam"
                            className={styles.input}
                            value={apiParam}
                            onChange={(e) => setApiParam(e.target.value)}
                            placeholder="Enter Name"
                        />
                        <button
                            className={styles.button}
                            onClick={handleRedirect}
                            disabled={!apiParam.trim()}
                        >
                            Go to API Page
                        </button>
                    </p>
                </section>
            </main>

            <footer className={styles.footer}>
                <p>Built with ❤️ using Next.js, TypeScript, and AWS.</p>
            </footer>
        </div>
    );
};

export default Home;