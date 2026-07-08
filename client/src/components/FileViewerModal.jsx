const FileViewerModal = ({ isOpen, onClose, filePath, repoUrl }) => {
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); 

    useEffect(() => {
        if (isOpen && filePath && repoUrl) {
            const fetchFileContent = async () => {
                setLoading(true);
                setError(null);
                try {
                    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/file-viewer`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filePath, repoUrl }),
                    });     

                    if (!response.ok) {
                        throw new Error(`Error fetching file content: ${response.statusText}`);
                    }

                    const data = await response.json();
                    setFileContent(data.content);
                } catch (err) {
                    setError(err.message);
                }       
                setLoading(false);
            };  
            fetchFileContent();
        }
    }, [isOpen, filePath, repoUrl]);

    return (    

        <Modal isOpen={isOpen} onClose={onClose} size="6xl">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>Viewing: {filePath}</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Spinner size="xl" />   
                        </div>
                    ) : error ? (
                        <div className="text-red-500 text-center">{error}</div>
                    ) : (       
                        <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-auto max-h-[60vh]">
                            <code>{fileContent}</code>
                        </pre>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default FileViewerModal