import { useParams, useSearchParams } from 'react-router-dom';
import { ForumDiscussion } from '@/components/Forum/ForumDiscussion';

export default function PostPage() {
  const { id = '' } = useParams(), [params] = useSearchParams();
  return <ForumDiscussion id={id} management={params.get('view') === 'manage'} />;
}
