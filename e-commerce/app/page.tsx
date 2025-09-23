'use client';

import Container from "./components/Container";
import HomeBanner from "./components/banner/HomeBanner";
export default function Home() {
  return (
    <div>
      <Container>
        <div>
          <HomeBanner />
        </div>
      </Container>
    </div>
  );
}
