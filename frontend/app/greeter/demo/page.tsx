import { GreeterYoloCall } from "@/components/greeter-yolo-call";

export default function DemoGreeterPage() {
  return (
    <GreeterYoloCall
      spaceId="demo"
      spaceName="Demo"
      videoInput="stock"
      stockVideoUrl="/stock/street_10.mp4"
    />
  );
}
